use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use chrono::{SecondsFormat, Utc};

use crate::config::{FeatureState, GameConfig, RuntimeCandidate};

#[path = "doctor_models.rs"]
mod doctor_models;
#[path = "doctor_runtime_selection.rs"]
mod doctor_runtime_selection;

pub use doctor_models::{CheckStatus, DependencyStatus, DoctorReport, RuntimeDiscovery};

pub fn run_doctor(config: Option<&GameConfig>) -> DoctorReport {
    let requested_proton_version = config.and_then(|cfg| {
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

    let runtime = doctor_runtime_selection::evaluate_runtime(
        config,
        proton.clone(),
        wine.clone(),
        umu_run.clone(),
        requested_proton_version.as_deref(),
        proton_version_matched,
    );

    let dependencies = evaluate_dependencies(config, &runtime);

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

fn evaluate_dependencies(
    config: Option<&GameConfig>,
    runtime: &RuntimeDiscovery,
) -> Vec<DependencyStatus> {
    let gamemode_state = config.map(|cfg| cfg.requirements.gamemode);
    let gamemoderun_bin = find_in_path("gamemoderun");
    let libgamemode = discover_gamemode_library();

    let mut out = vec![
        evaluate_component(
            "gamescope",
            config.map(|cfg| cfg.requirements.gamescope),
            find_in_path("gamescope"),
        ),
        evaluate_gamemoderun_component(
            gamemode_state,
            gamemoderun_bin.clone(),
            libgamemode.clone(),
        ),
        evaluate_component("libgamemode", gamemode_state, libgamemode.clone()),
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

    if let Some(cfg) = config {
        if matches!(runtime.selected_runtime, Some(RuntimeCandidate::ProtonUmu))
            && !matches!(gamemode_state, Some(FeatureState::MandatoryOff))
        {
            out.push(evaluate_gamemode_umu_runtime_component(
                gamemode_state,
                gamemoderun_bin.clone(),
                libgamemode.clone(),
                runtime.umu_run.as_deref().map(PathBuf::from),
            ));
        }

        out.push(evaluate_component(
            "eac-runtime",
            Some(cfg.compatibility.easy_anti_cheat_runtime),
            discover_proton_aux_runtime("PROTON_EAC_RUNTIME", "eac_runtime"),
        ));

        out.push(evaluate_component(
            "battleye-runtime",
            Some(cfg.compatibility.battleye_runtime),
            discover_proton_aux_runtime("PROTON_BATTLEYE_RUNTIME", "battleye_runtime"),
        ));

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

fn evaluate_gamemode_umu_runtime_component(
    state: Option<FeatureState>,
    gamemoderun_bin: Option<PathBuf>,
    libgamemode: Option<PathBuf>,
    umu_run: Option<PathBuf>,
) -> DependencyStatus {
    let force_enabled = gamemode_umu_force_enabled();
    let host_prereqs_ok = gamemoderun_bin.is_some() && libgamemode.is_some() && umu_run.is_some();
    let resolved_path = gamemoderun_bin
        .as_ref()
        .map(|p| path_to_string(p.clone()))
        .or_else(|| umu_run.as_ref().map(|p| path_to_string(p.clone())));

    let (status, found, note) = match state {
        Some(FeatureState::MandatoryOn) => {
            if host_prereqs_ok {
                (
                    CheckStatus::WARN,
                    true,
                    "host checks passed, but ProtonUmu/pressure-vessel compatibility is runtime-dependent; mandatory policy prevents automatic gamemode fallback".to_string(),
                )
            } else {
                (
                    CheckStatus::BLOCKER,
                    false,
                    "ProtonUmu + GameMode is required, but host prerequisites are missing".to_string(),
                )
            }
        }
        Some(FeatureState::OptionalOn) => {
            if !host_prereqs_ok {
                (
                    CheckStatus::WARN,
                    false,
                    "enabled in payload, but host GameMode prerequisites are missing (gamemoderun/libgamemode/umu-run)".to_string(),
                )
            } else if force_enabled {
                (
                    CheckStatus::INFO,
                    true,
                    "host checks passed; LUTHIER_FORCE_GAMEMODE_UMU=1 is set, so gamemoderun will be used (UMU container compatibility still depends on the runtime environment)".to_string(),
                )
            } else {
                (
                    CheckStatus::INFO,
                    true,
                    "host checks passed, but ProtonUmu/pressure-vessel GameMode compatibility is runtime-dependent; launcher will auto-skip gamemoderun by default (set LUTHIER_FORCE_GAMEMODE_UMU=1 to force)".to_string(),
                )
            }
        }
        Some(FeatureState::OptionalOff) => (
            CheckStatus::INFO,
            host_prereqs_ok,
            if host_prereqs_ok {
                "not required by current payload (ProtonUmu path); launcher would auto-skip gamemoderun unless forced".to_string()
            } else {
                "not required by current payload (ProtonUmu path)".to_string()
            },
        ),
        Some(FeatureState::MandatoryOff) => (
            CheckStatus::INFO,
            host_prereqs_ok,
            "forced off by policy".to_string(),
        ),
        None => (
            CheckStatus::INFO,
            host_prereqs_ok,
            "ProtonUmu selected; GameMode compatibility inside pressure-vessel is runtime-dependent".to_string(),
        ),
    };

    DependencyStatus {
        name: "gamemode-umu-runtime".to_string(),
        state,
        status,
        found,
        resolved_path,
        note,
    }
}

fn gamemode_umu_force_enabled() -> bool {
    env::var("LUTHIER_FORCE_GAMEMODE_UMU")
        .map(|value| {
            value == "1"
                || value.eq_ignore_ascii_case("true")
                || value.eq_ignore_ascii_case("yes")
                || value.eq_ignore_ascii_case("on")
        })
        .unwrap_or(false)
}

fn evaluate_gamemoderun_component(
    state: Option<FeatureState>,
    binary: Option<PathBuf>,
    libgamemode: Option<PathBuf>,
) -> DependencyStatus {
    if matches!(state, Some(FeatureState::MandatoryOff)) {
        return evaluate_component("gamemoderun", state, binary);
    }

    match (binary, libgamemode.is_some()) {
        (Some(binary_path), true) => evaluate_component("gamemoderun", state, Some(binary_path)),
        (Some(binary_path), false) => {
            let mut status = evaluate_component("gamemoderun", state, None);
            status.resolved_path = Some(path_to_string(binary_path));
            status.note = match state {
                Some(FeatureState::MandatoryOn) => {
                    "gamemoderun executable found, but libgamemode is missing".to_string()
                }
                Some(FeatureState::OptionalOn) | Some(FeatureState::OptionalOff) => {
                    "gamemoderun executable found, but libgamemode is missing".to_string()
                }
                Some(FeatureState::MandatoryOff) => "forced off by policy".to_string(),
                None => "gamemoderun executable found, but libgamemode is missing".to_string(),
            };
            status
        }
        (None, _) => evaluate_component("gamemoderun", state, None),
    }
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

fn discover_proton_aux_runtime(env_var: &str, folder_name: &str) -> Option<PathBuf> {
    if let Some(from_env) = env::var_os(env_var) {
        let candidate = PathBuf::from(from_env);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    let home = env::var_os("HOME")?;
    let home = PathBuf::from(home);
    let candidates = [
        home.join(".config/heroic/tools/runtimes").join(folder_name),
        home.join(".var/app/com.heroicgameslauncher.hgl/config/heroic/tools/runtimes")
            .join(folder_name),
        home.join(".local/share/Luthier/runtimes")
            .join(folder_name),
    ];

    candidates.into_iter().find(|path| path.exists())
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
        Some(FeatureState::OptionalOn) => {
            if found {
                (CheckStatus::OK, "enabled in payload and available")
            } else {
                (CheckStatus::WARN, "enabled in payload but missing")
            }
        }
        Some(FeatureState::OptionalOff) => {
            if found {
                (
                    CheckStatus::INFO,
                    "not required by current payload (available)",
                )
            } else {
                (
                    CheckStatus::INFO,
                    "not required by current payload (missing)",
                )
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

fn discover_gamemode_library() -> Option<PathBuf> {
    if let Some(path) =
        discover_shared_library_with_ldconfig(&["libgamemode.so.0", "libgamemode.so"])
    {
        return Some(path);
    }

    let mut dirs = Vec::new();
    if let Some(ld_library_path) = env::var_os("LD_LIBRARY_PATH") {
        dirs.extend(env::split_paths(&ld_library_path));
    }
    if let Some(library_path) = env::var_os("LIBRARY_PATH") {
        dirs.extend(env::split_paths(&library_path));
    }

    for dir in [
        "/usr/lib",
        "/usr/lib64",
        "/usr/local/lib",
        "/usr/local/lib64",
        "/usr/lib/x86_64-linux-gnu",
        "/usr/lib/i386-linux-gnu",
        "/lib",
        "/lib64",
        "/lib/x86_64-linux-gnu",
        "/lib/i386-linux-gnu",
    ] {
        dirs.push(PathBuf::from(dir));
    }

    for dir in dirs {
        for name in ["libgamemode.so.0", "libgamemode.so"] {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    None
}

fn discover_shared_library_with_ldconfig(names: &[&str]) -> Option<PathBuf> {
    let output = Command::new("ldconfig").arg("-p").output().ok()?;
    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for name in names {
        for line in stdout.lines() {
            let trimmed = line.trim();
            if !trimmed.starts_with(name) {
                continue;
            }

            let Some((_, path)) = trimmed.split_once("=>") else {
                continue;
            };
            let candidate = PathBuf::from(path.trim());
            if candidate.is_file() {
                return Some(candidate);
            }
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

        let reordered = super::doctor_runtime_selection::reorder_candidates(
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
