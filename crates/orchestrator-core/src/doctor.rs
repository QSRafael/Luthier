use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};

use crate::config::{FeatureState, GameConfig, RuntimeCandidate};

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
    let proton = discover_proton().map(path_to_string);
    let wine = discover_wine().map(path_to_string);
    let umu_run = discover_umu().map(path_to_string);

    let runtime = evaluate_runtime(config, proton.clone(), wine.clone(), umu_run.clone());

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
) -> RuntimeDiscovery {
    let has_proton = proton.is_some();
    let has_wine = wine.is_some();
    let has_umu = umu_run.is_some();

    if let Some(cfg) = config {
        let strict = cfg.requirements.runtime.strict;
        let primary = cfg.requirements.runtime.primary;
        let fallback = &cfg.requirements.runtime.fallback_order;

        let selected_runtime = if strict {
            if candidate_available(primary, has_proton, has_wine, has_umu) {
                Some(primary)
            } else {
                None
            }
        } else {
            let mut candidates = Vec::new();
            candidates.push(primary);
            candidates.extend(fallback.iter().copied());
            candidates
                .into_iter()
                .find(|c| candidate_available(*c, has_proton, has_wine, has_umu))
        };

        let (runtime_status, runtime_note) = if selected_runtime.is_some() {
            (CheckStatus::OK, "runtime candidate selected".to_string())
        } else {
            (
                CheckStatus::BLOCKER,
                "no runtime candidate available with current policy".to_string(),
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

        let (runtime_status, runtime_note) = if selected_runtime.is_some() {
            (CheckStatus::OK, "runtime discovered".to_string())
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
    let mut out = Vec::new();

    out.push(evaluate_component(
        "gamescope",
        config.map(|cfg| cfg.requirements.gamescope),
        find_in_path("gamescope"),
    ));

    out.push(evaluate_component(
        "gamemoderun",
        config.map(|cfg| cfg.requirements.gamemode),
        find_in_path("gamemoderun"),
    ));

    out.push(evaluate_component(
        "mangohud",
        config.map(|cfg| cfg.requirements.mangohud),
        find_in_path("mangohud"),
    ));

    out.push(evaluate_component(
        "winetricks",
        config.map(|cfg| cfg.requirements.winetricks),
        find_in_path("winetricks"),
    ));

    out.push(evaluate_component(
        "umu-run",
        config.map(|cfg| cfg.requirements.umu),
        discover_umu(),
    ));

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

fn discover_umu() -> Option<PathBuf> {
    if let Some(from_env) = env::var_os("UMU_RUNTIME") {
        let candidate = PathBuf::from(from_env);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    find_in_path("umu-run")
}

fn discover_wine() -> Option<PathBuf> {
    if let Some(from_env) = env::var_os("WINE") {
        let candidate = PathBuf::from(from_env);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    find_in_path("wine")
        .or_else(|| existing_path("/usr/bin/wine"))
        .or_else(|| existing_path("/usr/local/bin/wine"))
        .or_else(|| home_relative(".local/bin/wine"))
}

fn discover_proton() -> Option<PathBuf> {
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

fn known_proton_roots() -> Vec<PathBuf> {
    let mut out = Vec::new();

    if let Some(home) = env::var_os("HOME") {
        let home = PathBuf::from(home);
        out.push(home.join(".local/share/Steam/compatibilitytools.d"));
        out.push(home.join(".steam/root/compatibilitytools.d"));
        out.push(home.join(".steam/steam/compatibilitytools.d"));
    }

    out
}

fn proton_from_path(path: PathBuf) -> Option<PathBuf> {
    if path.is_file() {
        return Some(path);
    }

    let proton = path.join("proton");
    if proton.is_file() {
        return Some(proton);
    }

    None
}

fn find_latest_proton_from_root(root: &Path) -> Option<PathBuf> {
    let entries = fs::read_dir(root).ok()?;
    let mut candidates = Vec::<PathBuf>::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if let Some(proton) = proton_from_path(path) {
            candidates.push(proton);
        }
    }

    candidates.sort_by(|a, b| b.cmp(a));
    candidates.into_iter().next()
}

fn find_in_path(bin_name: &str) -> Option<PathBuf> {
    let paths = env::var_os("PATH")?;

    for dir in env::split_paths(&paths) {
        let candidate = dir.join(bin_name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    None
}

fn existing_path(path: &str) -> Option<PathBuf> {
    let path = PathBuf::from(path);
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

fn home_relative(path: &str) -> Option<PathBuf> {
    let home = env::var_os("HOME")?;
    let full = PathBuf::from(home).join(path);
    if full.exists() {
        Some(full)
    } else {
        None
    }
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
}
