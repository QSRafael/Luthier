use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

use anyhow::{anyhow, Context};
use luthier_orchestrator_core::{
    doctor::DoctorReport, prefix::base_env_for_prefix, FeatureState, GameConfig, RuntimeCandidate,
};

use crate::{
    application::runtime_overrides::feature_enabled, domain::models::LaunchCommandPlan,
    infrastructure::paths::resolve_relative_path,
};

pub fn build_launch_command(
    config: &GameConfig,
    report: &DoctorReport,
    game_root: &Path,
    prefix_path: &Path,
) -> anyhow::Result<LaunchCommandPlan> {
    let selected_runtime = report
        .runtime
        .selected_runtime
        .ok_or_else(|| anyhow!("doctor did not select a runtime"))?;

    let runtime_program =
        match selected_runtime {
            RuntimeCandidate::ProtonUmu => {
                report.runtime.umu_run.clone().ok_or_else(|| {
                    anyhow!("selected runtime ProtonUmu but umu-run path is missing")
                })?
            }
            RuntimeCandidate::ProtonNative => report.runtime.proton.clone().ok_or_else(|| {
                anyhow!("selected runtime ProtonNative but proton path is missing")
            })?,
            RuntimeCandidate::Wine => report
                .runtime
                .wine
                .clone()
                .ok_or_else(|| anyhow!("selected runtime Wine but wine path is missing"))?,
        };

    let game_exe = resolve_relative_path(game_root, &config.relative_exe_path)
        .context("invalid relative_exe_path in payload")?;
    let game_exe_str = game_exe.to_string_lossy().into_owned();

    let mut runtime_args = match selected_runtime {
        RuntimeCandidate::ProtonNative => vec!["run".to_string(), game_exe_str],
        _ => vec![game_exe_str],
    };
    runtime_args.extend(config.launch_args.clone());

    let mut command_tokens = vec![runtime_program.clone()];
    command_tokens.extend(runtime_args);

    let gamescope_active = feature_enabled(config.environment.gamescope.state);
    let mangohud_active = feature_enabled(config.requirements.mangohud);
    let mut plan_notes = Vec::new();

    if feature_enabled(config.requirements.gamemode) {
        let force_gamemode_umu = gamemode_umu_force_enabled();
        let auto_skip_gamemode_umu = matches!(selected_runtime, RuntimeCandidate::ProtonUmu)
            && matches!(config.requirements.gamemode, FeatureState::OptionalOn)
            && !force_gamemode_umu;

        if auto_skip_gamemode_umu {
            plan_notes.push(
                "GameMode wrapper skipped automatically for ProtonUmu (UMU/pressure-vessel may fail to load libgamemode and spam stderr). Set LUTHIER_FORCE_GAMEMODE_UMU=1 to force gamemoderun.".to_string(),
            );
        } else if let Some(path) = dependency_path(report, "gamemoderun") {
            command_tokens = wrap_command(path, vec![], command_tokens);
            if matches!(selected_runtime, RuntimeCandidate::ProtonUmu) && force_gamemode_umu {
                plan_notes.push(
                    "GameMode wrapper forced for ProtonUmu by LUTHIER_FORCE_GAMEMODE_UMU=1; compatibility depends on UMU/pressure-vessel runtime environment.".to_string(),
                );
            }
        } else if matches!(
            (selected_runtime, config.requirements.gamemode),
            (RuntimeCandidate::ProtonUmu, FeatureState::OptionalOn)
        ) {
            plan_notes.push(
                "GameMode is enabled in payload, but gamemoderun was not found; continuing without GameMode.".to_string(),
            );
        }
    }

    if mangohud_active && !gamescope_active {
        if let Some(path) = dependency_path(report, "mangohud") {
            command_tokens = wrap_command(path, vec![], command_tokens);
        }
    }

    for wrapper in config.compatibility.wrapper_commands.iter().rev() {
        if feature_enabled(wrapper.state) {
            let Some(wrapper_program) = resolve_wrapper_executable(&wrapper.executable) else {
                if matches!(wrapper.state, FeatureState::MandatoryOn) {
                    return Err(anyhow!(
                        "mandatory wrapper command '{}' is not available",
                        wrapper.executable
                    ));
                }
                continue;
            };

            let args = split_wrapper_args(&wrapper.args);
            command_tokens = wrap_command(wrapper_program, args, command_tokens);
        }
    }

    if gamescope_active {
        if let Some(path) = dependency_path(report, "gamescope") {
            let mut gamescope_args = Vec::new();
            let gamescope = &config.environment.gamescope;
            let supports_modern_filter = gamescope_supports_modern_filter(&path);

            let game_width = parse_u32_maybe_empty(&gamescope.game_width);
            let game_height = parse_u32_maybe_empty(&gamescope.game_height);
            if let Some(width) = game_width {
                gamescope_args.push("-w".to_string());
                gamescope_args.push(width.to_string());
            }
            if let Some(height) = game_height {
                gamescope_args.push("-h".to_string());
                gamescope_args.push(height.to_string());
            }

            let mut output_width = parse_u32_maybe_empty(&gamescope.output_width);
            let mut output_height = parse_u32_maybe_empty(&gamescope.output_height);
            if output_width.is_none() || output_height.is_none() {
                if let Some(resolution) = &gamescope.resolution {
                    if let Some((w, h)) = parse_resolution(resolution) {
                        output_width.get_or_insert(w);
                        output_height.get_or_insert(h);
                    }
                }
            }
            if let Some(width) = output_width {
                gamescope_args.push("-W".to_string());
                gamescope_args.push(width.to_string());
            }
            if let Some(height) = output_height {
                gamescope_args.push("-H".to_string());
                gamescope_args.push(height.to_string());
            }

            let upscaling_configured = game_width.is_some()
                || game_height.is_some()
                || output_width.is_some()
                || output_height.is_some()
                || gamescope.fsr;
            if upscaling_configured {
                let method = if gamescope.fsr && gamescope.upscale_method.trim().is_empty() {
                    "fsr"
                } else {
                    gamescope.upscale_method.trim()
                };
                apply_gamescope_upscale_flags(&mut gamescope_args, method, supports_modern_filter);
            }

            match gamescope.window_type.trim() {
                "fullscreen" => {
                    gamescope_args.push("-f".to_string());
                    if host_wayland_session_detected() {
                        plan_notes.push(
                            "Gamescope fullscreen flag (-f) was applied. In nested Wayland sessions, compositors may still present the gamescope surface as a window.".to_string(),
                        );
                    }
                }
                "borderless" => gamescope_args.push("-b".to_string()),
                _ => {}
            }

            if gamescope.enable_limiter {
                if let Some(value) = non_empty_trimmed(&gamescope.fps_limiter) {
                    gamescope_args.push("-r".to_string());
                    gamescope_args.push(value.to_string());
                }
                if let Some(value) = non_empty_trimmed(&gamescope.fps_limiter_no_focus) {
                    gamescope_args.push("-o".to_string());
                    gamescope_args.push(value.to_string());
                }
            }

            if gamescope.force_grab_cursor {
                gamescope_args.push("--force-grab-cursor".to_string());
            }

            if mangohud_active {
                gamescope_args.push("--mangoapp".to_string());
            }

            gamescope_args.extend(split_shell_like_args(&gamescope.additional_options));

            gamescope_args.push("--".to_string());
            gamescope_args.extend(command_tokens);
            command_tokens = wrap_command(path, gamescope_args, Vec::new());
        }
    }

    let (program, args) = split_program_and_args(command_tokens)
        .ok_or_else(|| anyhow!("failed to build launch command"))?;

    let effective_prefix_path = effective_prefix_path_for_runtime(prefix_path, selected_runtime);
    let mut env_pairs = base_env_for_prefix(&effective_prefix_path);
    if matches!(
        selected_runtime,
        RuntimeCandidate::ProtonUmu | RuntimeCandidate::ProtonNative
    ) {
        remove_env(&mut env_pairs, "PROTON_VERB");
    }

    if matches!(
        selected_runtime,
        RuntimeCandidate::ProtonUmu | RuntimeCandidate::ProtonNative
    ) {
        upsert_env(
            &mut env_pairs,
            "STEAM_COMPAT_DATA_PATH",
            prefix_path.to_string_lossy().into_owned(),
        );

        if let Some(proton_path) = &report.runtime.proton {
            if let Some(steam_client_path) = derive_steam_client_install_path(proton_path) {
                upsert_env(
                    &mut env_pairs,
                    "STEAM_COMPAT_CLIENT_INSTALL_PATH",
                    steam_client_path,
                );
            }
        }
    }

    if matches!(selected_runtime, RuntimeCandidate::ProtonUmu) {
        if let Some(proton_path) = &report.runtime.proton {
            if let Some(proton_root) = proton_root_from_script(proton_path) {
                upsert_env(&mut env_pairs, "PROTONPATH", proton_root);
            }
        }
    }

    apply_heroic_like_runtime_env_defaults(
        &mut env_pairs,
        config,
        report,
        selected_runtime,
        Some(game_root),
        true,
    );

    if config.environment.prime_offload.is_enabled() {
        upsert_env(&mut env_pairs, "__NV_PRIME_RENDER_OFFLOAD", "1");
        upsert_env(&mut env_pairs, "__GLX_VENDOR_LIBRARY_NAME", "nvidia");
        upsert_env(&mut env_pairs, "DRI_PRIME", "1");
    }

    for (key, value) in &config.environment.custom_vars {
        if is_protected_env_key(key) {
            continue;
        }
        upsert_env(&mut env_pairs, key, value);
    }

    Ok(LaunchCommandPlan {
        program,
        args,
        cwd: game_root.to_string_lossy().into_owned(),
        runtime: format!("{:?}", selected_runtime),
        env: env_pairs,
        notes: plan_notes,
    })
}

pub fn build_winecfg_command(
    config: &GameConfig,
    report: &DoctorReport,
    prefix_path: &Path,
) -> anyhow::Result<LaunchCommandPlan> {
    let selected_runtime = report
        .runtime
        .selected_runtime
        .ok_or_else(|| anyhow!("doctor did not select a runtime"))?;

    let mut command_tokens = match selected_runtime {
        RuntimeCandidate::ProtonUmu => {
            let umu =
                report.runtime.umu_run.clone().ok_or_else(|| {
                    anyhow!("selected runtime ProtonUmu but umu-run path is missing")
                })?;
            vec![umu, "winecfg".to_string()]
        }
        RuntimeCandidate::ProtonNative => {
            let proton = report.runtime.proton.clone().ok_or_else(|| {
                anyhow!("selected runtime ProtonNative but proton path is missing")
            })?;
            vec![proton, "run".to_string(), "winecfg".to_string()]
        }
        RuntimeCandidate::Wine => {
            let wine = report
                .runtime
                .wine
                .clone()
                .ok_or_else(|| anyhow!("selected runtime Wine but wine path is missing"))?;
            let winecfg_program = Path::new(&wine)
                .parent()
                .map(|parent| parent.join("winecfg"))
                .filter(|candidate| candidate.exists())
                .map(|candidate| candidate.to_string_lossy().into_owned())
                .unwrap_or_else(|| "winecfg".to_string());
            vec![winecfg_program]
        }
    };

    let (program, args) = split_program_and_args(std::mem::take(&mut command_tokens))
        .ok_or_else(|| anyhow!("failed to build winecfg command"))?;

    let effective_prefix_path = effective_prefix_path_for_runtime(prefix_path, selected_runtime);
    let mut env_pairs = base_env_for_prefix(&effective_prefix_path);
    if matches!(
        selected_runtime,
        RuntimeCandidate::ProtonUmu | RuntimeCandidate::ProtonNative
    ) {
        remove_env(&mut env_pairs, "PROTON_VERB");
    }
    if matches!(
        selected_runtime,
        RuntimeCandidate::ProtonUmu | RuntimeCandidate::ProtonNative
    ) {
        upsert_env(
            &mut env_pairs,
            "STEAM_COMPAT_DATA_PATH",
            prefix_path.to_string_lossy().into_owned(),
        );

        if let Some(proton_path) = &report.runtime.proton {
            if let Some(steam_client_path) = derive_steam_client_install_path(proton_path) {
                upsert_env(
                    &mut env_pairs,
                    "STEAM_COMPAT_CLIENT_INSTALL_PATH",
                    steam_client_path,
                );
            }
        }
    }

    if matches!(selected_runtime, RuntimeCandidate::ProtonUmu) {
        if let Some(proton_path) = &report.runtime.proton {
            if let Some(proton_root) = proton_root_from_script(proton_path) {
                upsert_env(&mut env_pairs, "PROTONPATH", proton_root);
            }
        }
    }

    apply_heroic_like_runtime_env_defaults(
        &mut env_pairs,
        config,
        report,
        selected_runtime,
        None,
        false,
    );

    if config.environment.prime_offload.is_enabled() {
        upsert_env(&mut env_pairs, "__NV_PRIME_RENDER_OFFLOAD", "1");
        upsert_env(&mut env_pairs, "__GLX_VENDOR_LIBRARY_NAME", "nvidia");
        upsert_env(&mut env_pairs, "DRI_PRIME", "1");
    }

    for (key, value) in &config.environment.custom_vars {
        if is_protected_env_key(key) {
            continue;
        }
        upsert_env(&mut env_pairs, key, value);
    }

    Ok(LaunchCommandPlan {
        program,
        args,
        cwd: prefix_path.to_string_lossy().into_owned(),
        runtime: format!("{:?}", selected_runtime),
        env: env_pairs,
        notes: Vec::new(),
    })
}

fn dependency_path(report: &DoctorReport, name: &str) -> Option<String> {
    report
        .dependencies
        .iter()
        .find(|dep| dep.name == name && dep.found)
        .and_then(|dep| dep.resolved_path.clone())
}

fn resolve_wrapper_executable(executable: &str) -> Option<String> {
    let path = Path::new(executable);
    if executable.contains('/') || path.is_absolute() {
        return is_executable_file(path).then(|| path.to_string_lossy().into_owned());
    }

    find_in_path(executable)
        .filter(|path| is_executable_file(path))
        .map(|path| path.to_string_lossy().into_owned())
}

fn find_in_path(bin_name: &str) -> Option<PathBuf> {
    let paths = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&paths) {
        let candidate = dir.join(bin_name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
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

fn split_wrapper_args(raw: &str) -> Vec<String> {
    raw.split_whitespace().map(ToString::to_string).collect()
}

fn wrap_command(program: String, args: Vec<String>, inner: Vec<String>) -> Vec<String> {
    let mut out = Vec::with_capacity(1 + args.len() + inner.len());
    out.push(program);
    out.extend(args);
    out.extend(inner);
    out
}

fn split_program_and_args(tokens: Vec<String>) -> Option<(String, Vec<String>)> {
    let mut iter = tokens.into_iter();
    let program = iter.next()?;
    let args = iter.collect::<Vec<String>>();
    Some((program, args))
}

fn parse_resolution(raw: &str) -> Option<(u32, u32)> {
    let cleaned = raw.trim().replace('X', "x");
    let (w, h) = cleaned.split_once('x')?;
    let width = w.trim().parse::<u32>().ok()?;
    let height = h.trim().parse::<u32>().ok()?;
    Some((width, height))
}

fn parse_u32_maybe_empty(raw: &str) -> Option<u32> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    trimmed.parse::<u32>().ok()
}

fn non_empty_trimmed(raw: &str) -> Option<&str> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn split_shell_like_args(raw: &str) -> Vec<String> {
    // Matches current wrapper arg parsing behavior. Quoted args are not preserved yet.
    raw.split_whitespace().map(ToString::to_string).collect()
}

fn gamemode_umu_force_enabled() -> bool {
    truthy_env_flag("LUTHIER_FORCE_GAMEMODE_UMU")
}

fn host_wayland_session_detected() -> bool {
    truthy_env_flag("WAYLAND_DISPLAY")
        || std::env::var("XDG_SESSION_TYPE")
            .map(|value| value.eq_ignore_ascii_case("wayland"))
            .unwrap_or(false)
}

fn truthy_env_flag(name: &str) -> bool {
    std::env::var(name)
        .map(|value| {
            let trimmed = value.trim();
            !trimmed.is_empty()
                && (trimmed == "1"
                    || trimmed.eq_ignore_ascii_case("true")
                    || trimmed.eq_ignore_ascii_case("yes")
                    || trimmed.eq_ignore_ascii_case("on")
                    || (!trimmed.contains('=') && name == "WAYLAND_DISPLAY"))
        })
        .unwrap_or(false)
}

fn gamescope_supports_modern_filter(gamescope_path: &str) -> bool {
    let Ok(output) = Command::new(gamescope_path).arg("--help").output() else {
        return false;
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    stdout.contains("-F, --filter") || stderr.contains("-F, --filter")
}

fn apply_gamescope_upscale_flags(
    gamescope_args: &mut Vec<String>,
    raw_method: &str,
    supports_modern_filter: bool,
) {
    let method = raw_method.trim().to_ascii_lowercase();
    if method.is_empty() {
        return;
    }

    if supports_modern_filter {
        match method.as_str() {
            "fsr" | "nis" => {
                gamescope_args.push("-F".to_string());
                gamescope_args.push(method);
            }
            "integer" | "stretch" => {
                gamescope_args.push("-S".to_string());
                gamescope_args.push(method);
            }
            _ => {}
        }
        return;
    }

    match method.as_str() {
        "fsr" => gamescope_args.push("-U".to_string()),
        "nis" => gamescope_args.push("-Y".to_string()),
        "integer" => gamescope_args.push("-i".to_string()),
        "stretch" => {}
        _ => {}
    }
}

fn upsert_env(
    env_pairs: &mut Vec<(String, String)>,
    key: impl Into<String>,
    value: impl Into<String>,
) {
    let key = key.into();
    let value = value.into();

    if let Some((_, existing_value)) = env_pairs
        .iter_mut()
        .find(|(existing_key, _)| existing_key == &key)
    {
        *existing_value = value;
        return;
    }

    env_pairs.push((key, value));
}

fn remove_env(env_pairs: &mut Vec<(String, String)>, key: &str) {
    env_pairs.retain(|(existing_key, _)| existing_key != key);
}

fn is_protected_env_key(key: &str) -> bool {
    matches!(
        key,
        "WINEPREFIX"
            | "PROTON_VERB"
            | "STEAM_COMPAT_DATA_PATH"
            | "STEAM_COMPAT_CLIENT_INSTALL_PATH"
            | "STEAM_COMPAT_INSTALL_PATH"
            | "STEAM_COMPAT_APP_ID"
            | "SteamAppId"
            | "SteamGameId"
            | "PROTONPATH"
            | "GAMEID"
            | "UMU_RUNTIME_UPDATE"
    )
}

fn apply_heroic_like_runtime_env_defaults(
    env_pairs: &mut Vec<(String, String)>,
    config: &GameConfig,
    report: &DoctorReport,
    runtime: RuntimeCandidate,
    game_install_path: Option<&Path>,
    set_ld_preload_default: bool,
) {
    let is_proton = matches!(
        runtime,
        RuntimeCandidate::ProtonNative | RuntimeCandidate::ProtonUmu
    );

    if is_proton {
        if let Some(game_install_path) = game_install_path {
            upsert_env(
                env_pairs,
                "STEAM_COMPAT_INSTALL_PATH",
                game_install_path.to_string_lossy().into_owned(),
            );
        }

        if let Some(proton_path) = &report.runtime.proton {
            if let Some(steam_client_path) = derive_steam_client_install_path(proton_path) {
                upsert_env(
                    env_pairs,
                    "STEAM_COMPAT_CLIENT_INSTALL_PATH",
                    steam_client_path,
                );
            }

            if let Some(proton_root) = proton_root_from_script(proton_path) {
                upsert_env(env_pairs, "PROTONPATH", proton_root);
            }
        }

        let steam_compat_app_id =
            std::env::var("STEAM_COMPAT_APP_ID").unwrap_or_else(|_| "0".to_string());
        let steam_app_id =
            std::env::var("SteamAppId").unwrap_or_else(|_| steam_compat_app_id.clone());
        let steam_game_id =
            std::env::var("SteamGameId").unwrap_or_else(|_| heroic_steam_game_id(config));

        upsert_env(env_pairs, "STEAM_COMPAT_APP_ID", steam_compat_app_id);
        upsert_env(env_pairs, "SteamAppId", steam_app_id);
        upsert_env(env_pairs, "SteamGameId", steam_game_id);

        if let Some(home) = std::env::var_os("HOME") {
            upsert_env(
                env_pairs,
                "PROTON_LOG_DIR",
                PathBuf::from(home).to_string_lossy().into_owned(),
            );
        }

        apply_proton_feature_envs(env_pairs, config);
        apply_proton_aux_runtime_envs(env_pairs, config, report);
    } else {
        apply_wine_feature_envs(env_pairs, config);
    }

    if matches!(runtime, RuntimeCandidate::ProtonUmu) {
        let game_id = std::env::var("GAMEID").unwrap_or_else(|_| "umu-0".to_string());
        let umu_runtime_update = std::env::var("UMU_RUNTIME_UPDATE").unwrap_or_else(|_| {
            if config.runner.auto_update {
                "1".to_string()
            } else {
                "0".to_string()
            }
        });
        upsert_env(env_pairs, "GAMEID", game_id);
        upsert_env(env_pairs, "UMU_RUNTIME_UPDATE", umu_runtime_update);
    }

    if set_ld_preload_default
        && std::env::var_os("LD_PRELOAD").is_none()
        && !env_pairs.iter().any(|(key, _)| key == "LD_PRELOAD")
    {
        upsert_env(env_pairs, "LD_PRELOAD", "");
    }
}

fn apply_proton_feature_envs(env_pairs: &mut Vec<(String, String)>, config: &GameConfig) {
    if !config.runner.esync {
        upsert_env(env_pairs, "PROTON_NO_ESYNC", "1");
    }

    if !config.runner.fsync {
        upsert_env(env_pairs, "PROTON_NO_FSYNC", "1");
    }

    if feature_enabled(config.compatibility.wine_wayland) {
        upsert_env(env_pairs, "PROTON_ENABLE_WAYLAND", "1");

        if feature_enabled(config.compatibility.hdr) {
            upsert_env(env_pairs, "PROTON_ENABLE_HDR", "1");
        }
    }

    if feature_enabled(config.compatibility.auto_dxvk_nvapi) {
        upsert_env(env_pairs, "PROTON_ENABLE_NVAPI", "1");
        upsert_env(env_pairs, "DXVK_NVAPI_ALLOW_OTHER_DRIVERS", "1");
    } else {
        upsert_env(env_pairs, "PROTON_DISABLE_NVAPI", "1");
    }
}

fn apply_wine_feature_envs(env_pairs: &mut Vec<(String, String)>, config: &GameConfig) {
    if config.runner.esync {
        upsert_env(env_pairs, "WINEESYNC", "1");
    }

    if config.runner.fsync {
        upsert_env(env_pairs, "WINEFSYNC", "1");
    }

    if feature_enabled(config.compatibility.wine_wayland) {
        upsert_env(env_pairs, "DISPLAY", "");

        if feature_enabled(config.compatibility.hdr) {
            upsert_env(env_pairs, "DXVK_HDR", "1");
        }
    }

    if feature_enabled(config.compatibility.auto_dxvk_nvapi) {
        upsert_env(env_pairs, "DXVK_ENABLE_NVAPI", "1");
        upsert_env(env_pairs, "DXVK_NVAPI_ALLOW_OTHER_DRIVERS", "1");
    }
}

fn apply_proton_aux_runtime_envs(
    env_pairs: &mut Vec<(String, String)>,
    config: &GameConfig,
    report: &DoctorReport,
) {
    if feature_enabled(config.compatibility.easy_anti_cheat_runtime) {
        if let Some(path) = dependency_path(report, "eac-runtime") {
            upsert_env(env_pairs, "PROTON_EAC_RUNTIME", path);
        }
    }

    if feature_enabled(config.compatibility.battleye_runtime) {
        if let Some(path) = dependency_path(report, "battleye-runtime") {
            upsert_env(env_pairs, "PROTON_BATTLEYE_RUNTIME", path);
        }
    }
}

fn heroic_steam_game_id(config: &GameConfig) -> String {
    let suffix = if config.exe_hash.trim().is_empty() {
        "0"
    } else {
        config.exe_hash.trim()
    };

    format!("heroic-{suffix}")
}

pub fn effective_prefix_path_for_runtime(prefix_root: &Path, runtime: RuntimeCandidate) -> PathBuf {
    match runtime {
        RuntimeCandidate::ProtonNative | RuntimeCandidate::ProtonUmu => prefix_root.join("pfx"),
        RuntimeCandidate::Wine => prefix_root.to_path_buf(),
    }
}

fn derive_steam_client_install_path(proton_binary_path: &str) -> Option<String> {
    let proton_path = Path::new(proton_binary_path);
    let proton_dir = proton_path.parent()?;
    let common_dir = proton_dir.parent()?;
    let steamapps_dir = common_dir.parent()?;
    let steamapps_name = steamapps_dir
        .file_name()?
        .to_string_lossy()
        .to_ascii_lowercase();
    if steamapps_name != "steamapps" {
        return None;
    }

    let steam_root = steamapps_dir.parent()?;
    Some(steam_root.to_string_lossy().into_owned())
}

fn proton_root_from_script(proton_binary_path: &str) -> Option<String> {
    let proton_path = Path::new(proton_binary_path);
    let proton_dir = proton_path.parent()?;
    Some(proton_dir.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_resolution_accepts_valid_formats() {
        assert_eq!(parse_resolution("1920x1080"), Some((1920, 1080)));
        assert_eq!(parse_resolution(" 1280 X 720 "), Some((1280, 720)));
        assert_eq!(parse_resolution("800x600"), Some((800, 600)));
    }

    #[test]
    fn parse_resolution_rejects_invalid_formats() {
        assert_eq!(parse_resolution(""), None);
        assert_eq!(parse_resolution("1920"), None);
        assert_eq!(parse_resolution("1920x"), None);
        assert_eq!(parse_resolution("x1080"), None);
        assert_eq!(parse_resolution("abcx1080"), None);
        assert_eq!(parse_resolution("1920xabc"), None);
    }

    #[test]
    fn parse_u32_maybe_empty_handles_optional_and_invalid_values() {
        assert_eq!(parse_u32_maybe_empty(""), None);
        assert_eq!(parse_u32_maybe_empty("   "), None);
        assert_eq!(parse_u32_maybe_empty("60"), Some(60));
        assert_eq!(parse_u32_maybe_empty(" 144 "), Some(144));
        assert_eq!(parse_u32_maybe_empty("-1"), None);
        assert_eq!(parse_u32_maybe_empty("NaN"), None);
    }

    #[test]
    fn apply_gamescope_upscale_flags_uses_modern_filter_flags_when_supported() {
        let mut args = Vec::new();
        apply_gamescope_upscale_flags(&mut args, "fsr", true);
        assert_eq!(args, vec!["-F", "fsr"]);

        args.clear();
        apply_gamescope_upscale_flags(&mut args, " nis ", true);
        assert_eq!(args, vec!["-F", "nis"]);

        args.clear();
        apply_gamescope_upscale_flags(&mut args, "integer", true);
        assert_eq!(args, vec!["-S", "integer"]);

        args.clear();
        apply_gamescope_upscale_flags(&mut args, "stretch", true);
        assert_eq!(args, vec!["-S", "stretch"]);

        args.clear();
        apply_gamescope_upscale_flags(&mut args, "unknown", true);
        assert!(args.is_empty());
    }

    #[test]
    fn apply_gamescope_upscale_flags_uses_legacy_flags_when_modern_filter_unavailable() {
        let mut args = Vec::new();
        apply_gamescope_upscale_flags(&mut args, "fsr", false);
        assert_eq!(args, vec!["-U"]);

        args.clear();
        apply_gamescope_upscale_flags(&mut args, "nis", false);
        assert_eq!(args, vec!["-Y"]);

        args.clear();
        apply_gamescope_upscale_flags(&mut args, "integer", false);
        assert_eq!(args, vec!["-i"]);

        args.clear();
        apply_gamescope_upscale_flags(&mut args, "stretch", false);
        assert!(args.is_empty());

        args.clear();
        apply_gamescope_upscale_flags(&mut args, "", false);
        assert!(args.is_empty());
    }

    #[test]
    fn protected_env_key_helper_identifies_reserved_keys() {
        assert!(is_protected_env_key("WINEPREFIX"));
        assert!(is_protected_env_key("PROTON_VERB"));
        assert!(is_protected_env_key("STEAM_COMPAT_DATA_PATH"));
        assert!(is_protected_env_key("PROTONPATH"));
        assert!(is_protected_env_key("GAMEID"));
        assert!(is_protected_env_key("UMU_RUNTIME_UPDATE"));

        assert!(!is_protected_env_key("CUSTOM_ENV"));
        assert!(!is_protected_env_key("PATH"));
        assert!(!is_protected_env_key("STEAM_COMPAT_DATA_PATH_EXTRA"));
    }

    #[test]
    fn upsert_and_remove_env_helpers_work_without_side_effects() {
        let mut env_pairs = vec![
            ("WINEPREFIX".to_string(), "/tmp/pfx".to_string()),
            ("CUSTOM_A".to_string(), "1".to_string()),
        ];

        upsert_env(&mut env_pairs, "CUSTOM_B", "2");
        assert!(env_pairs
            .iter()
            .any(|(key, value)| key == "CUSTOM_B" && value == "2"));

        upsert_env(&mut env_pairs, "CUSTOM_A", "99");
        assert!(env_pairs
            .iter()
            .any(|(key, value)| key == "CUSTOM_A" && value == "99"));
        assert_eq!(
            env_pairs
                .iter()
                .filter(|(key, _)| key == "CUSTOM_A")
                .count(),
            1
        );

        remove_env(&mut env_pairs, "CUSTOM_B");
        assert!(!env_pairs.iter().any(|(key, _)| key == "CUSTOM_B"));
        assert!(env_pairs.iter().any(|(key, _)| key == "WINEPREFIX"));
    }
}
