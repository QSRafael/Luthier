use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};

use crate::config::{FeatureState, GameConfig, RuntimeCandidate, RuntimePreference};

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum CheckStatus {
    OK,
    WARN,
    BLOCKER,
    INFO,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DependencyStatus {
    pub name: String,
    pub state: Option<FeatureState>,
    pub status: CheckStatus,
    pub found: bool,
    pub resolved_path: Option<String>,
    pub note: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RuntimeDiscovery {
    pub proton: Option<String>,
    pub wine: Option<String>,
    pub umu_run: Option<String>,
    pub selected_runtime: Option<RuntimeCandidate>,
    pub runtime_status: CheckStatus,
    pub runtime_note: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DoctorReport {
    pub generated_at: String,
    pub has_embedded_config: bool,
    pub runtime: RuntimeDiscovery,
    pub dependencies: Vec<DependencyStatus>,
    pub summary: CheckStatus,
}

pub fn run_doctor(config: Option<&GameConfig>) -> DoctorReport {
    let requested_proton_version = config
        .and_then(|cfg| {
            let value = cfg.runner.proton_version.trim();
            if value.is_empty() {
                None
            } else {
                Some(value.to_string())
            }
        });
    let (proton_path, proton_version_matched) =
        discover_proton_with_preference(requested_proton_version.as_deref());
    let proton = proton_path.map(path_to_string);
    let wine = discover_wine().map(path_to_string);
    let umu_run = discover_umu().map(path_to_string);

    let runtime = evaluate_runtime(
        config,
        proton.clone(),
        wine.clone(),
        umu_run.clone(),
        requested_proton_version.as_deref(),
        proton_version_matched,
    );

    let dependencies = evaluate_dependencies(config);

    let mut summary = runtime.runtime_status;
    for dep in &dependencies {
        summary = worse_status(summary, dep.status);
    }

    DoctorReport {
        generated_at: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
        has_embedded_config: config.is_some(),
        runtime,
        dependencies,
        summary,
    }
}

fn evaluate_runtime(
    config: Option<&GameConfig>,
    proton: Option<String>,
    wine: Option<String>,
    umu_run: Option<String>,
    requested_proton_version: Option<&str>,
    proton_version_matched: bool,
) -> RuntimeDiscovery {
    let has_proton = proton.is_some();
    let has_wine = wine.is_some();
    let has_umu = umu_run.is_some();

    if let Some(cfg) = config {
        let strict = cfg.requirements.runtime.strict;
        let candidates = effective_runtime_candidates(cfg);

        let selected_runtime = if strict {
            if let Some(primary) = candidates.first().copied() {
                if candidate_available(primary, has_proton, has_wine, has_umu) {
                    Some(primary)
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            candidates
                .into_iter()
                .find(|c| candidate_available(*c, has_proton, has_wine, has_umu))
        };

        let proton_runtime_selected = matches!(
            selected_runtime,
            Some(RuntimeCandidate::ProtonNative | RuntimeCandidate::ProtonUmu)
        );

        let (runtime_status, runtime_note) = if selected_runtime.is_none() {
            (
                CheckStatus::BLOCKER,
                "no runtime candidate available with current policy".to_string(),
            )
        } else if proton_runtime_selected {
            match (requested_proton_version, proton.as_deref(), proton_version_matched) {
                (Some(requested), Some(selected_path), true) => (
                    CheckStatus::OK,
                    format!(
                        "runtime candidate selected (requested proton version '{requested}' found at {selected_path})"
                    ),
                ),
                (Some(requested), Some(selected_path), false) if strict => (
                    CheckStatus::BLOCKER,
                    format!(
                        "requested proton version '{requested}' not found and runtime strict mode is enabled (fallback candidate path: {selected_path})"
                    ),
                ),
                (Some(requested), Some(selected_path), false) => (
                    CheckStatus::WARN,
                    format!(
                        "requested proton version '{requested}' not found; using fallback proton at {selected_path}"
                    ),
                ),
                _ => (CheckStatus::OK, "runtime candidate selected".to_string()),
            }
        } else {
            (CheckStatus::OK, "runtime candidate selected".to_string())
        };

        RuntimeDiscovery {
            proton,
            wine,
            umu_run,
            selected_runtime,
            runtime_status,
            runtime_note,
        }
    } else {
        let selected_runtime = if has_umu && has_proton {
            Some(RuntimeCandidate::ProtonUmu)
        } else if has_proton {
            Some(RuntimeCandidate::ProtonNative)
        } else if has_wine {
            Some(RuntimeCandidate::Wine)
        } else {
            None
        };

        let (runtime_status, runtime_note) = if let Some(selected) = selected_runtime {
            if matches!(selected, RuntimeCandidate::ProtonNative | RuntimeCandidate::ProtonUmu) {
                match (requested_proton_version, proton.as_deref(), proton_version_matched) {
                    (Some(requested), Some(selected_path), true) => (
                        CheckStatus::OK,
                        format!(
                            "runtime discovered (requested proton version '{requested}' found at {selected_path})"
                        ),
                    ),
                    (Some(requested), Some(selected_path), false) => (
                        CheckStatus::WARN,
                        format!(
                            "runtime discovered but requested proton version '{requested}' was not found; using {selected_path}"
                        ),
                    ),
                    _ => (CheckStatus::OK, "runtime discovered".to_string()),
                }
            } else {
                (CheckStatus::OK, "runtime discovered".to_string())
            }
        } else {
            (
                CheckStatus::WARN,
                "no runtime discovered (doctor without embedded config)".to_string(),
            )
        };

        RuntimeDiscovery {
            proton,
            wine,
            umu_run,
            selected_runtime,
            runtime_status,
            runtime_note,
        }
    }
}

fn evaluate_dependencies(config: Option<&GameConfig>) -> Vec<DependencyStatus> {
    let mut out = vec![
        evaluate_component(
            "gamescope",
            config.map(|cfg| cfg.requirements.gamescope),
            find_in_path("gamescope"),
        ),
        evaluate_component(
            "gamemoderun",
            config.map(|cfg| cfg.requirements.gamemode),
            find_in_path("gamemoderun"),
        ),
        evaluate_component(
            "mangohud",
            config.map(|cfg| cfg.requirements.mangohud),
            find_in_path("mangohud"),
        ),
        evaluate_component(
            "winetricks",
            config.map(|cfg| cfg.requirements.winetricks),
            find_in_path("winetricks"),
        ),
        evaluate_component(
            "umu-run",
            config.map(|cfg| cfg.requirements.umu),
            discover_umu(),
        ),
    ];

    let steam_runtime_found = env::var_os("STEAM_RUNTIME")
        .and_then(|v| if v.is_empty() { None } else { Some(v) })
        .map(PathBuf::from);
    out.push(evaluate_component(
        "steam-runtime",
        config.map(|cfg| cfg.requirements.steam_runtime),
        steam_runtime_found,
    ));

    if let Some(cfg) = config {
        for dep in &cfg.extra_system_dependencies {
            let found = find_dependency_from_rules(
                dep.check_commands.as_slice(),
                dep.check_env_vars.as_slice(),
                dep.check_paths.as_slice(),
            );
            out.push(evaluate_component(&dep.name, Some(dep.state), found));
        }
    }

    out
}

fn find_dependency_from_rules(
    commands: &[String],
    env_vars: &[String],
    paths: &[String],
) -> Option<PathBuf> {
    for command in commands {
        if let Some(path) = find_in_path(command) {
            return Some(path);
        }
    }

    for key in env_vars {
        if let Some(value) = env::var_os(key) {
            let path = PathBuf::from(value);
            if path.exists() {
                return Some(path);
            }
        }
    }

    for raw_path in paths {
        let path = PathBuf::from(raw_path);
        if path.exists() {
            return Some(path);
        }
    }

    None
}

fn evaluate_component(
    name: &str,
    state: Option<FeatureState>,
    resolved: Option<PathBuf>,
) -> DependencyStatus {
    let found = resolved.is_some();

    let (status, note) = match state {
        Some(FeatureState::MandatoryOn) => {
            if found {
                (CheckStatus::OK, "required and available")
            } else {
                (CheckStatus::BLOCKER, "required but missing")
            }
        }
        Some(FeatureState::MandatoryOff) => (CheckStatus::INFO, "forced off by policy"),
        Some(FeatureState::OptionalOn) | Some(FeatureState::OptionalOff) => {
            if found {
                (CheckStatus::OK, "optional and available")
            } else {
                (CheckStatus::WARN, "optional and missing")
            }
        }
        None => {
            if found {
                (CheckStatus::OK, "available")
            } else {
                (CheckStatus::WARN, "not found")
            }
        }
    };

    DependencyStatus {
        name: name.to_string(),
        state,
        status,
        found,
        resolved_path: resolved.map(path_to_string),
        note: note.to_string(),
    }
}

fn candidate_available(
    candidate: RuntimeCandidate,
    has_proton: bool,
    has_wine: bool,
    has_umu: bool,
) -> bool {
    match candidate {
        RuntimeCandidate::ProtonUmu => has_umu && has_proton,
        RuntimeCandidate::ProtonNative => has_proton,
        RuntimeCandidate::Wine => has_wine,
    }
}

fn effective_runtime_candidates(cfg: &GameConfig) -> Vec<RuntimeCandidate> {
    let mut base = Vec::new();
    push_unique_candidate(&mut base, cfg.requirements.runtime.primary);
    for candidate in &cfg.requirements.runtime.fallback_order {
        push_unique_candidate(&mut base, *candidate);
    }

    match cfg.runner.runtime_preference {
        RuntimePreference::Auto => base,
        RuntimePreference::Proton => reorder_candidates(
            &base,
            &[
                RuntimeCandidate::ProtonUmu,
                RuntimeCandidate::ProtonNative,
                RuntimeCandidate::Wine,
            ],
        ),
        RuntimePreference::Wine => reorder_candidates(
            &base,
            &[
                RuntimeCandidate::Wine,
                RuntimeCandidate::ProtonUmu,
                RuntimeCandidate::ProtonNative,
            ],
        ),
    }
}

fn reorder_candidates(
    base: &[RuntimeCandidate],
    preferred_order: &[RuntimeCandidate],
) -> Vec<RuntimeCandidate> {
    let mut out = Vec::new();

    for preferred in preferred_order {
        if base.contains(preferred) {
            push_unique_candidate(&mut out, *preferred);
        }
    }

    for candidate in base {
        push_unique_candidate(&mut out, *candidate);
    }

    out
}

fn push_unique_candidate(out: &mut Vec<RuntimeCandidate>, candidate: RuntimeCandidate) {
    if !out.contains(&candidate) {
        out.push(candidate);
    }
}

fn discover_umu() -> Option<PathBuf> {
    if let Some(from_env) = env::var_os("UMU_RUNTIME") {
        let candidate = PathBuf::from(from_env);
        if is_executable_file(&candidate) {
            return Some(candidate);
        }
    }

    find_in_path("umu-run")
}

fn discover_wine() -> Option<PathBuf> {
    if let Some(from_env) = env::var_os("WINE") {
        let candidate = PathBuf::from(from_env);
        if is_executable_file(&candidate) {
            return Some(candidate);
        }
    }

    find_in_path("wine")
        .or_else(|| existing_executable_path("/usr/bin/wine"))
        .or_else(|| existing_executable_path("/usr/local/bin/wine"))
        .or_else(|| home_relative_executable(".local/bin/wine"))
}

fn discover_proton_with_preference(requested_version: Option<&str>) -> (Option<PathBuf>, bool) {
    let requested_version = requested_version.map(str::trim).filter(|v| !v.is_empty());

    if let Some(requested) = requested_version {
        if let Some(found) = find_proton_by_requested_version(requested) {
            return (Some(found), true);
        }

        return (discover_latest_proton(), false);
    }

    (discover_latest_proton(), false)
}

fn discover_latest_proton() -> Option<PathBuf> {
    if let Some(from_env) = env::var_os("PROTONPATH") {
        if let Some(path) = proton_from_path(PathBuf::from(from_env)) {
            return Some(path);
        }
    }

    if let Some(paths) = env::var_os("STEAM_COMPAT_TOOL_PATHS") {
        for p in env::split_paths(&paths) {
            if let Some(path) = proton_from_path(p) {
                return Some(path);
            }
        }
    }

    for root in known_proton_roots() {
        if let Some(found) = find_latest_proton_from_root(&root) {
            return Some(found);
        }
    }

    None
}

fn find_proton_by_requested_version(requested_version: &str) -> Option<PathBuf> {
    if let Some(direct) = proton_from_path(PathBuf::from(requested_version)) {
        return Some(direct);
    }

    if let Some(from_env) = env::var_os("PROTONPATH") {
        if let Some(path) = proton_from_path(PathBuf::from(from_env)) {
            if proton_path_matches_requested_version(&path, requested_version) {
                return Some(path);
            }
        }
    }

    if let Some(paths) = env::var_os("STEAM_COMPAT_TOOL_PATHS") {
        for p in env::split_paths(&paths) {
            if let Some(path) = proton_from_path(p) {
                if proton_path_matches_requested_version(&path, requested_version) {
                    return Some(path);
                }
            }
        }
    }

    let mut exact: Option<(SystemTime, PathBuf)> = None;
    let mut fuzzy: Option<(SystemTime, PathBuf)> = None;

    for root in known_proton_roots() {
        let entries = match fs::read_dir(&root) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let entry_path = entry.path();
            let proton_path = match proton_from_path(entry_path) {
                Some(path) => path,
                None => continue,
            };

            let parent_name = proton_path
                .parent()
                .and_then(|p| p.file_name())
                .and_then(|n| n.to_str())
                .unwrap_or_default()
                .to_ascii_lowercase();
            let requested_lower = requested_version.to_ascii_lowercase();
            let modified = path_modified_or_epoch(&proton_path);

            if parent_name == requested_lower {
                match &exact {
                    Some((best_modified, best_path))
                        if modified < *best_modified
                            || (modified == *best_modified && proton_path <= *best_path) => {}
                    _ => exact = Some((modified, proton_path)),
                }
                continue;
            }

            if proton_path_matches_requested_version(&proton_path, requested_version) {
                match &fuzzy {
                    Some((best_modified, best_path))
                        if modified < *best_modified
                            || (modified == *best_modified && proton_path <= *best_path) => {}
                    _ => fuzzy = Some((modified, proton_path)),
                }
            }
        }
    }

    exact.or(fuzzy).map(|(_, path)| path)
}

fn known_proton_roots() -> Vec<PathBuf> {
    let mut out = Vec::new();

    if let Some(home) = env::var_os("HOME") {
        let home = PathBuf::from(home);
        // Heroic (native package)
        out.push(home.join(".config/heroic/tools/proton"));
        // Heroic (Flatpak)
        out.push(home.join(".var/app/com.heroicgameslauncher.hgl/config/heroic/tools/proton"));

        out.push(home.join(".local/share/Steam/compatibilitytools.d"));
        out.push(home.join(".steam/root/compatibilitytools.d"));
        out.push(home.join(".steam/steam/compatibilitytools.d"));
        out.push(home.join(".local/share/Steam/steamapps/common"));
        out.push(home.join(".steam/root/steamapps/common"));
        out.push(home.join(".steam/steam/steamapps/common"));
    }

    out
}

fn proton_from_path(path: PathBuf) -> Option<PathBuf> {
    if is_executable_file(&path) {
        return Some(path);
    }

    let proton = path.join("proton");
    if is_executable_file(&proton) {
        return Some(proton);
    }

    None
}

fn proton_path_matches_requested_version(proton_path: &Path, requested_version: &str) -> bool {
    let requested = requested_version.trim();
    if requested.is_empty() {
        return false;
    }

    let requested_lower = requested.to_ascii_lowercase();
    let proton_path_string = proton_path.to_string_lossy().to_ascii_lowercase();

    if proton_path_string == requested_lower {
        return true;
    }

    if proton_path_string.contains(&requested_lower) {
        return true;
    }

    // Heroic commonly exposes "GE-Proton-latest" as a symlink. Match against the canonical
    // target path too so a request like "GE-Proton10-32" resolves correctly.
    if let Ok(canonical) = proton_path.canonicalize() {
        let canonical_string = canonical.to_string_lossy().to_ascii_lowercase();
        if canonical_string == requested_lower || canonical_string.contains(&requested_lower) {
            return true;
        }

        let canonical_parent = canonical
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        if canonical_parent == requested_lower || canonical_parent.contains(&requested_lower) {
            return true;
        }
    }

    let parent_name = proton_path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    parent_name == requested_lower || parent_name.contains(&requested_lower)
}

fn find_latest_proton_from_root(root: &Path) -> Option<PathBuf> {
    let entries = fs::read_dir(root).ok()?;
    let mut best: Option<(SystemTime, PathBuf)> = None;

    for entry in entries.flatten() {
        let path = entry.path();
        if let Some(proton) = proton_from_path(path) {
            let modified = path_modified_or_epoch(&proton);
            match &best {
                Some((best_modified, best_path))
                    if modified < *best_modified
                        || (modified == *best_modified && proton <= *best_path) => {}
                _ => best = Some((modified, proton)),
            }
        }
    }

    best.map(|(_, path)| path)
}

fn find_in_path(bin_name: &str) -> Option<PathBuf> {
    let paths = env::var_os("PATH")?;

    for dir in env::split_paths(&paths) {
        let candidate = dir.join(bin_name);
        if is_executable_file(&candidate) {
            return Some(candidate);
        }
    }

    None
}

fn existing_executable_path(path: &str) -> Option<PathBuf> {
    let path = PathBuf::from(path);
    if is_executable_file(&path) {
        Some(path)
    } else {
        None
    }
}

fn home_relative_executable(path: &str) -> Option<PathBuf> {
    let home = env::var_os("HOME")?;
    let full = PathBuf::from(home).join(path);
    if is_executable_file(&full) {
        Some(full)
    } else {
        None
    }
}

fn is_executable_file(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::metadata(path)
            .map(|meta| meta.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
    }

    #[cfg(not(unix))]
    {
        true
    }
}

fn path_modified_or_epoch(path: &Path) -> SystemTime {
    path.parent()
        .and_then(|parent| fs::metadata(parent).ok())
        .and_then(|meta| meta.modified().ok())
        .unwrap_or(UNIX_EPOCH)
}

fn path_to_string(path: PathBuf) -> String {
    path.to_string_lossy().into_owned()
}

fn worse_status(a: CheckStatus, b: CheckStatus) -> CheckStatus {
    use CheckStatus::*;

    let rank = |value| match value {
        BLOCKER => 3,
        WARN => 2,
        OK => 1,
        INFO => 0,
    };

    if rank(a) >= rank(b) {
        a
    } else {
        b
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn worse_status_prefers_blocker() {
        assert_eq!(
            worse_status(CheckStatus::OK, CheckStatus::BLOCKER),
            CheckStatus::BLOCKER
        );
        assert_eq!(
            worse_status(CheckStatus::WARN, CheckStatus::INFO),
            CheckStatus::WARN
        );
    }

    #[test]
    fn evaluates_component_policies() {
        let missing_mandatory =
            evaluate_component("gamescope", Some(FeatureState::MandatoryOn), None);
        assert_eq!(missing_mandatory.status, CheckStatus::BLOCKER);

        let forced_off = evaluate_component("gamescope", Some(FeatureState::MandatoryOff), None);
        assert_eq!(forced_off.status, CheckStatus::INFO);
    }

    #[test]
    fn reorder_candidates_prioritizes_preferred_entries_present_in_policy() {
        let base = vec![
            RuntimeCandidate::ProtonNative,
            RuntimeCandidate::Wine,
            RuntimeCandidate::ProtonUmu,
        ];

        let reordered = reorder_candidates(
            &base,
            &[
                RuntimeCandidate::ProtonUmu,
                RuntimeCandidate::ProtonNative,
                RuntimeCandidate::Wine,
            ],
        );

        assert_eq!(
            reordered,
            vec![
                RuntimeCandidate::ProtonUmu,
                RuntimeCandidate::ProtonNative,
                RuntimeCandidate::Wine,
            ]
        );
    }
}
