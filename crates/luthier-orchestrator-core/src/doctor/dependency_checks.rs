use std::env;
use std::path::PathBuf;
use std::process::Command;

use crate::config::{FeatureState, GameConfig, RuntimeCandidate};

use super::{host_probe, CheckStatus, DependencyStatus, RuntimeDiscovery};

pub(super) fn evaluate_dependencies(
    config: Option<&GameConfig>,
    runtime: &RuntimeDiscovery,
) -> Vec<DependencyStatus> {
    let gamemode_state = config.map(|cfg| cfg.requirements.gamemode);
    let gamemoderun_bin = host_probe::find_in_path("gamemoderun");
    let libgamemode = discover_gamemode_library();

    let mut out = vec![
        evaluate_component(
            "gamescope",
            config.map(|cfg| cfg.requirements.gamescope),
            host_probe::find_in_path("gamescope"),
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
            host_probe::find_in_path("mangohud"),
        ),
        evaluate_component(
            "winetricks",
            config.map(|cfg| cfg.requirements.winetricks),
            host_probe::find_in_path("winetricks"),
        ),
        evaluate_component(
            "umu-run",
            config.map(|cfg| cfg.requirements.umu),
            host_probe::discover_umu(),
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
        .map(|p| host_probe::path_to_string(p.clone()))
        .or_else(|| {
            umu_run
                .as_ref()
                .map(|p| host_probe::path_to_string(p.clone()))
        });

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
            status.resolved_path = Some(host_probe::path_to_string(binary_path));
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
        if let Some(path) = host_probe::find_in_path(command) {
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
        home.join(".local/share/Luthier/runtimes").join(folder_name),
    ];

    candidates.into_iter().find(|path| path.exists())
}

pub(super) fn evaluate_component(
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
        resolved_path: resolved.map(host_probe::path_to_string),
        note: note.to_string(),
    }
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
