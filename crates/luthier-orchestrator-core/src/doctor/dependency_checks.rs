use std::env;
use std::path::PathBuf;
use std::process::Command;

use crate::config::{FeatureState, GameConfig, RuntimeCandidate};

use super::{host_probe, CheckStatus, DependencyStatus, RuntimeDiscovery};

#[derive(Debug, Clone)]
struct CapabilityProbe {
    supported: bool,
    resolved_path: Option<PathBuf>,
    note: String,
}

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
        out.push(evaluate_component(
            "steam-runtime",
            Some(cfg.requirements.steam_runtime),
            discover_steam_runtime(runtime),
        ));

        let wine_wayland_probe = probe_wine_wayland_support(runtime);
        out.push(evaluate_capability_component(
            "wine-wayland",
            cfg.compatibility.wine_wayland,
            wine_wayland_probe.clone(),
        ));

        let hdr_probe = probe_hdr_support(cfg.compatibility.wine_wayland, &wine_wayland_probe);
        out.push(evaluate_capability_component(
            "hdr",
            cfg.compatibility.hdr,
            hdr_probe,
        ));

        let nvapi_probe = probe_nvapi_support(runtime);
        out.push(evaluate_capability_component(
            "dxvk-nvapi",
            cfg.compatibility.auto_dxvk_nvapi,
            nvapi_probe,
        ));

        let staging_probe = probe_staging_support(runtime);
        out.push(evaluate_capability_component(
            "staging",
            cfg.compatibility.staging,
            staging_probe,
        ));

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

fn evaluate_capability_component(
    name: &str,
    state: FeatureState,
    probe: CapabilityProbe,
) -> DependencyStatus {
    let found = probe.supported;
    let (status, note) = match state {
        FeatureState::MandatoryOn => {
            if found {
                (
                    CheckStatus::OK,
                    format!("required and available ({})", probe.note),
                )
            } else {
                (
                    CheckStatus::BLOCKER,
                    format!("required but missing ({})", probe.note),
                )
            }
        }
        FeatureState::MandatoryOff => (CheckStatus::INFO, "forced off by policy".to_string()),
        FeatureState::OptionalOn => {
            if found {
                (
                    CheckStatus::OK,
                    format!("enabled in payload and available ({})", probe.note),
                )
            } else {
                (
                    CheckStatus::WARN,
                    format!("enabled in payload but missing ({})", probe.note),
                )
            }
        }
        FeatureState::OptionalOff => {
            if found {
                (
                    CheckStatus::INFO,
                    format!(
                        "not required by current payload (available: {})",
                        probe.note
                    ),
                )
            } else {
                (
                    CheckStatus::INFO,
                    format!("not required by current payload (missing: {})", probe.note),
                )
            }
        }
    };

    DependencyStatus {
        name: name.to_string(),
        state: Some(state),
        status,
        found,
        resolved_path: probe.resolved_path.map(host_probe::path_to_string),
        note,
    }
}

fn discover_steam_runtime(runtime: &RuntimeDiscovery) -> Option<PathBuf> {
    if matches!(runtime.selected_runtime, Some(RuntimeCandidate::ProtonUmu)) {
        if let Some(umu) = runtime.umu_run.as_deref() {
            return Some(PathBuf::from(umu));
        }
    }

    if let Some(path) = discover_path_from_env_var("STEAM_RUNTIME") {
        return Some(path);
    }

    if let Some(path) = host_probe::find_in_path("steam-runtime-launch-client") {
        return Some(path);
    }

    if let Some(path) = host_probe::find_in_path("steam-runtime-launcher-service") {
        return Some(path);
    }

    if let Some(home) = env::var_os("HOME") {
        let home = PathBuf::from(home);
        let candidates = [
            home.join(".local/share/Steam/ubuntu12_32/steam-runtime/run.sh"),
            home.join(".steam/root/ubuntu12_32/steam-runtime/run.sh"),
            home.join(".steam/steam/ubuntu12_32/steam-runtime/run.sh"),
        ];
        for candidate in candidates {
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    None
}

fn probe_wine_wayland_support(runtime: &RuntimeDiscovery) -> CapabilityProbe {
    if !wayland_session_detected() {
        return CapabilityProbe {
            supported: false,
            resolved_path: None,
            note: "Wayland session not detected".to_string(),
        };
    }

    match runtime.selected_runtime {
        Some(RuntimeCandidate::ProtonNative | RuntimeCandidate::ProtonUmu) => CapabilityProbe {
            supported: true,
            resolved_path: runtime.proton.as_deref().map(PathBuf::from),
            note: "selected runtime is Proton in a Wayland session".to_string(),
        },
        Some(RuntimeCandidate::Wine) => {
            let wine_path = runtime.wine.as_deref().map(PathBuf::from);
            if let Some(driver) = discover_wine_wayland_driver_path(runtime.wine.as_deref()) {
                CapabilityProbe {
                    supported: true,
                    resolved_path: Some(driver),
                    note: "winewayland driver was detected".to_string(),
                }
            } else {
                CapabilityProbe {
                    supported: false,
                    resolved_path: wine_path,
                    note: "selected Wine runtime does not expose winewayland driver".to_string(),
                }
            }
        }
        None => CapabilityProbe {
            supported: false,
            resolved_path: None,
            note: "no runtime selected".to_string(),
        },
    }
}

fn probe_hdr_support(
    wine_wayland_state: FeatureState,
    wine_wayland_probe: &CapabilityProbe,
) -> CapabilityProbe {
    if !wine_wayland_state.is_enabled() {
        return CapabilityProbe {
            supported: false,
            resolved_path: None,
            note: "HDR requires wine-wayland enabled".to_string(),
        };
    }

    if !wine_wayland_probe.supported {
        return CapabilityProbe {
            supported: false,
            resolved_path: None,
            note: format!(
                "wine-wayland support is unavailable ({})",
                wine_wayland_probe.note
            ),
        };
    }

    CapabilityProbe {
        supported: true,
        resolved_path: wine_wayland_probe.resolved_path.clone(),
        note: "wine-wayland support is available".to_string(),
    }
}

fn probe_nvapi_support(runtime: &RuntimeDiscovery) -> CapabilityProbe {
    match runtime.selected_runtime {
        Some(RuntimeCandidate::ProtonNative | RuntimeCandidate::ProtonUmu) => CapabilityProbe {
            supported: true,
            resolved_path: runtime.proton.as_deref().map(PathBuf::from),
            note: "selected runtime is Proton".to_string(),
        },
        Some(RuntimeCandidate::Wine) => CapabilityProbe {
            supported: false,
            resolved_path: runtime.wine.as_deref().map(PathBuf::from),
            note: "selected runtime is Wine (NVAPI auto mode expects Proton runtime support)"
                .to_string(),
        },
        None => CapabilityProbe {
            supported: false,
            resolved_path: None,
            note: "no runtime selected".to_string(),
        },
    }
}

fn probe_staging_support(runtime: &RuntimeDiscovery) -> CapabilityProbe {
    match runtime.selected_runtime {
        Some(RuntimeCandidate::Wine) => {
            let wine_path = runtime.wine.as_deref().map(PathBuf::from);
            if let Some(version) = query_wine_version(runtime.wine.as_deref()) {
                let version_lower = version.to_ascii_lowercase();
                if version_lower.contains("staging") {
                    CapabilityProbe {
                        supported: true,
                        resolved_path: wine_path,
                        note: format!("Wine version indicates staging build ({})", version.trim()),
                    }
                } else {
                    CapabilityProbe {
                        supported: false,
                        resolved_path: wine_path,
                        note: format!(
                            "Wine version does not indicate staging support ({})",
                            version.trim()
                        ),
                    }
                }
            } else {
                CapabilityProbe {
                    supported: false,
                    resolved_path: wine_path,
                    note: "failed to query Wine version for staging support".to_string(),
                }
            }
        }
        Some(RuntimeCandidate::ProtonNative | RuntimeCandidate::ProtonUmu) => CapabilityProbe {
            supported: false,
            resolved_path: runtime.proton.as_deref().map(PathBuf::from),
            note: "staging requires a Wine runtime build, not Proton".to_string(),
        },
        None => CapabilityProbe {
            supported: false,
            resolved_path: None,
            note: "no runtime selected".to_string(),
        },
    }
}

fn query_wine_version(wine_path: Option<&str>) -> Option<String> {
    let wine_path = wine_path?;
    let output = Command::new(wine_path).arg("--version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let merged = format!("{}{}", stdout, stderr);
    let trimmed = merged.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn wayland_session_detected() -> bool {
    if env::var_os("WAYLAND_DISPLAY").is_some() {
        return true;
    }
    env::var("XDG_SESSION_TYPE")
        .map(|value| value.eq_ignore_ascii_case("wayland"))
        .unwrap_or(false)
}

fn discover_wine_wayland_driver_path(wine_path: Option<&str>) -> Option<PathBuf> {
    let wine_path = PathBuf::from(wine_path?);
    let bin_dir = wine_path.parent()?;
    let candidates = [
        bin_dir.join("../lib/wine/x86_64-unix/winewayland.drv"),
        bin_dir.join("../lib64/wine/x86_64-unix/winewayland.drv"),
        bin_dir.join("../lib/wine/i386-unix/winewayland.drv"),
        bin_dir.join("../lib32/wine/i386-unix/winewayland.drv"),
        bin_dir.join("../lib/wine/winewayland.drv"),
        bin_dir.join("../lib64/wine/winewayland.drv"),
    ];
    candidates.into_iter().find(|path| path.exists())
}

fn discover_path_from_env_var(name: &str) -> Option<PathBuf> {
    let raw = env::var(name).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    if truthy_flag(trimmed) && !trimmed.contains('/') {
        return None;
    }

    let path = PathBuf::from(trimmed);
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

fn truthy_flag(value: &str) -> bool {
    value == "1"
        || value.eq_ignore_ascii_case("true")
        || value.eq_ignore_ascii_case("yes")
        || value.eq_ignore_ascii_case("on")
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
