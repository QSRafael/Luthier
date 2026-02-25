use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use anyhow::{anyhow, Context};
use orchestrator_core::{
    doctor::DoctorReport,
    prefix::{base_env_for_prefix, PrefixSetupPlan},
    process::{execute_external_command, CommandExecutionResult, ExternalCommand},
    FeatureState, GameConfig, RuntimeCandidate,
};
use serde::Serialize;

use crate::{overrides::feature_enabled, paths::resolve_relative_path};

#[derive(Debug, Serialize)]
pub struct LaunchCommandPlan {
    pub program: String,
    pub args: Vec<String>,
    pub cwd: String,
    pub runtime: String,
    pub env: Vec<(String, String)>,
}

#[derive(Debug, Clone)]
pub struct PrefixSetupExecutionContext {
    pub plan: PrefixSetupPlan,
    pub env: Vec<(String, String)>,
    pub prefix_root_path: PathBuf,
    pub effective_prefix_path: PathBuf,
}

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

    if feature_enabled(config.requirements.gamemode) {
        if let Some(path) = dependency_path(report, "gamemoderun") {
            command_tokens = wrap_command(path, vec![], command_tokens);
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

            if let Some(resolution) = &config.environment.gamescope.resolution {
                if let Some((w, h)) = parse_resolution(resolution) {
                    gamescope_args.push("-w".to_string());
                    gamescope_args.push(w.to_string());
                    gamescope_args.push("-h".to_string());
                    gamescope_args.push(h.to_string());
                }
            }

            if config.environment.gamescope.fsr {
                gamescope_args.push("-F".to_string());
                gamescope_args.push("fsr".to_string());
            }

            if mangohud_active {
                gamescope_args.push("--mangoapp".to_string());
            }

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
            let winecfg_program = std::path::Path::new(&wine)
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
    })
}

pub fn build_prefix_setup_execution_context(
    config: &GameConfig,
    plan: &PrefixSetupPlan,
    report: &DoctorReport,
) -> anyhow::Result<PrefixSetupExecutionContext> {
    let runtime = report
        .runtime
        .selected_runtime
        .ok_or_else(|| anyhow!("doctor did not select a runtime"))?;

    let prefix_root_path = PathBuf::from(&plan.prefix_path);
    let effective_prefix_path = effective_prefix_path_for_runtime(&prefix_root_path, runtime);
    let mut env = base_env_for_prefix(&effective_prefix_path);

    // Avoid wine gecko/mono popup dialogs during automated prefix bootstrap.
    upsert_env(&mut env, "WINEDLLOVERRIDES", "mscoree,mshtml=d");

    if matches!(
        runtime,
        RuntimeCandidate::ProtonNative | RuntimeCandidate::ProtonUmu
    ) {
        upsert_env(
            &mut env,
            "STEAM_COMPAT_DATA_PATH",
            prefix_root_path.to_string_lossy().into_owned(),
        );

        if let Some(proton_path) = &report.runtime.proton {
            if let Some(steam_client_path) = derive_steam_client_install_path(proton_path) {
                upsert_env(
                    &mut env,
                    "STEAM_COMPAT_CLIENT_INSTALL_PATH",
                    steam_client_path,
                );
            }

            if let Some(proton_bin_dir) = proton_bin_dir_from_script(proton_path) {
                prepend_path_env(&mut env, &proton_bin_dir);

                for (name, file) in [
                    ("WINE", "wine"),
                    ("WINE64", "wine64"),
                    ("WINESERVER", "wineserver"),
                ] {
                    let candidate = proton_bin_dir.join(file);
                    if candidate.is_file() {
                        upsert_env(&mut env, name, candidate.to_string_lossy().into_owned());
                    }
                }
            }

            if matches!(runtime, RuntimeCandidate::ProtonUmu) {
                if let Some(proton_root) = proton_root_from_script(proton_path) {
                    upsert_env(&mut env, "PROTONPATH", proton_root);
                }
            }
        }
    }

    apply_heroic_like_runtime_env_defaults(&mut env, config, report, runtime, None, false);

    let mut adapted_plan = adapt_prefix_setup_plan_for_runtime(plan, report, runtime)?;
    filter_installed_winetricks_verbs(&mut adapted_plan, &effective_prefix_path);

    Ok(PrefixSetupExecutionContext {
        plan: adapted_plan,
        env,
        prefix_root_path,
        effective_prefix_path,
    })
}

pub fn apply_registry_keys_if_present(
    config: &GameConfig,
    report: &DoctorReport,
    prefix_root_path: &Path,
    dry_run: bool,
) -> anyhow::Result<Option<CommandExecutionResult>> {
    if config.registry_keys.is_empty() {
        return Ok(None);
    }

    let selected_runtime = report
        .runtime
        .selected_runtime
        .ok_or_else(|| anyhow!("doctor did not select a runtime"))?;
    let effective_prefix_path =
        effective_prefix_path_for_runtime(prefix_root_path, selected_runtime);

    let reg_windows_path =
        write_registry_import_file(&config.registry_keys, &effective_prefix_path)?;
    let command_plan =
        build_regedit_import_command(config, report, prefix_root_path, &reg_windows_path)
            .context("failed to build registry import command")?;

    let command = ExternalCommand {
        name: "registry-import".to_string(),
        program: command_plan.program,
        args: command_plan.args,
        timeout_secs: Some(120),
        cwd: Some(command_plan.cwd),
        mandatory: true,
    };

    Ok(Some(execute_external_command(
        &command,
        &command_plan.env,
        dry_run,
    )))
}

pub fn execute_script_if_present(
    name: &str,
    script: &str,
    cwd: &str,
    env_pairs: &[(String, String)],
    dry_run: bool,
    mandatory: bool,
) -> Option<CommandExecutionResult> {
    if script.trim().is_empty() {
        return None;
    }

    let command = ExternalCommand {
        name: name.to_string(),
        program: "bash".to_string(),
        args: vec!["-lc".to_string(), script.to_string()],
        timeout_secs: Some(600),
        cwd: Some(cwd.to_string()),
        mandatory,
    };

    Some(execute_external_command(&command, env_pairs, dry_run))
}

pub fn validate_integrity(config: &GameConfig, game_root: &Path) -> anyhow::Result<Vec<String>> {
    let mut missing = Vec::new();

    let exe_path = resolve_relative_path(game_root, &config.relative_exe_path)
        .with_context(|| format!("invalid relative_exe_path '{}'", config.relative_exe_path))?;
    if !exe_path.exists() {
        missing.push(config.relative_exe_path.clone());
    }

    for file in &config.integrity_files {
        let path = resolve_relative_path(game_root, file)
            .with_context(|| format!("invalid path '{file}'"))?;
        if !path.exists() {
            missing.push(file.clone());
        }
    }

    Ok(missing)
}

pub fn dry_run_enabled() -> bool {
    std::env::var("GAME_ORCH_DRY_RUN")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
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
    let (w, h) = raw.split_once('x')?;
    let width = w.parse::<u32>().ok()?;
    let height = h.parse::<u32>().ok()?;
    Some((width, height))
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

fn prepend_path_env(env_pairs: &mut Vec<(String, String)>, prefix: &Path) {
    let prefix = prefix.to_string_lossy().into_owned();
    let existing = env_pairs
        .iter()
        .find(|(k, _)| k == "PATH")
        .map(|(_, v)| v.clone())
        .or_else(|| std::env::var("PATH").ok())
        .unwrap_or_default();

    let value = if existing.is_empty() {
        prefix
    } else {
        format!("{prefix}:{existing}")
    };
    upsert_env(env_pairs, "PATH", value);
}

fn filter_installed_winetricks_verbs(plan: &mut PrefixSetupPlan, effective_prefix_path: &Path) {
    let installed = read_installed_winetricks_verbs(effective_prefix_path);
    if installed.is_empty() {
        return;
    }

    let mut filtered_commands = Vec::with_capacity(plan.commands.len());

    for mut command in std::mem::take(&mut plan.commands) {
        if command.program != "winetricks" {
            filtered_commands.push(command);
            continue;
        }

        let (flags, verbs) = split_winetricks_command_args(&command.args);
        if verbs.is_empty() {
            filtered_commands.push(command);
            continue;
        }

        let remaining_verbs = verbs
            .into_iter()
            .filter(|verb| !installed.contains(verb))
            .collect::<Vec<_>>();

        if remaining_verbs.is_empty() {
            plan.notes.push(
                "all configured winetricks verbs already installed; skipping winetricks step"
                    .to_string(),
            );
            continue;
        }

        let mut args = flags;
        args.extend(remaining_verbs);
        command.args = args;
        filtered_commands.push(command);
    }

    plan.commands = filtered_commands;
}

fn read_installed_winetricks_verbs(
    effective_prefix_path: &Path,
) -> std::collections::BTreeSet<String> {
    let path = effective_prefix_path.join("winetricks.log");
    let Ok(raw) = fs::read_to_string(path) else {
        return std::collections::BTreeSet::new();
    };

    raw.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToString::to_string)
        .collect()
}

fn split_winetricks_command_args(args: &[String]) -> (Vec<String>, Vec<String>) {
    let mut flags = Vec::new();
    let mut verbs = Vec::new();

    for arg in args {
        if verbs.is_empty() && arg.starts_with('-') {
            flags.push(arg.clone());
        } else {
            verbs.push(arg.clone());
        }
    }

    (flags, verbs)
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
    } else {
        apply_wine_feature_envs(env_pairs, config);
    }

    if matches!(runtime, RuntimeCandidate::ProtonUmu) {
        let game_id = std::env::var("GAMEID").unwrap_or_else(|_| "umu-0".to_string());
        let umu_runtime_update =
            std::env::var("UMU_RUNTIME_UPDATE").unwrap_or_else(|_| "0".to_string());
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

fn build_regedit_import_command(
    config: &GameConfig,
    report: &DoctorReport,
    prefix_root_path: &Path,
    reg_windows_path: &str,
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
            vec![
                umu,
                "regedit.exe".to_string(),
                "/S".to_string(),
                reg_windows_path.to_string(),
            ]
        }
        RuntimeCandidate::ProtonNative => {
            let proton = report.runtime.proton.clone().ok_or_else(|| {
                anyhow!("selected runtime ProtonNative but proton path is missing")
            })?;
            vec![
                proton,
                "run".to_string(),
                "regedit.exe".to_string(),
                "/S".to_string(),
                reg_windows_path.to_string(),
            ]
        }
        RuntimeCandidate::Wine => {
            let wine = report
                .runtime
                .wine
                .clone()
                .ok_or_else(|| anyhow!("selected runtime Wine but wine path is missing"))?;
            let regedit_program = Path::new(&wine)
                .parent()
                .map(|parent| parent.join("regedit"))
                .filter(|candidate| candidate.exists())
                .map(|candidate| candidate.to_string_lossy().into_owned())
                .unwrap_or_else(|| "regedit".to_string());
            vec![
                regedit_program,
                "/S".to_string(),
                reg_windows_path.to_string(),
            ]
        }
    };

    let (program, args) = split_program_and_args(std::mem::take(&mut command_tokens))
        .ok_or_else(|| anyhow!("failed to build registry import command"))?;

    let mut env_pairs = build_winecfg_command(config, report, prefix_root_path)
        .context("failed to derive registry import env from runtime")?
        .env;

    // The `winecfg` helper already adds protected env keys. We only need command/env.
    Ok(LaunchCommandPlan {
        program,
        args,
        cwd: prefix_root_path.to_string_lossy().into_owned(),
        runtime: format!("{:?}", selected_runtime),
        env: std::mem::take(&mut env_pairs),
    })
}

fn write_registry_import_file(
    registry_keys: &[orchestrator_core::RegistryKey],
    effective_prefix_path: &Path,
) -> anyhow::Result<String> {
    let temp_dir = effective_prefix_path.join("drive_c/windows/temp");
    fs::create_dir_all(&temp_dir)
        .context("failed to create Windows temp directory inside prefix")?;

    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let file_name = format!("go_registry_import_{nonce}.reg");
    let file_path = temp_dir.join(&file_name);

    let raw = render_registry_file(registry_keys);
    let utf16 = encode_utf16le_with_bom(&raw);
    fs::write(&file_path, utf16).context("failed to write temporary .reg import file")?;

    Ok(format!(r"C:\windows\temp\{file_name}"))
}

fn render_registry_file(registry_keys: &[orchestrator_core::RegistryKey]) -> String {
    let mut out = String::from("Windows Registry Editor Version 5.00\r\n\r\n");
    let mut current_path: Option<&str> = None;

    for key in registry_keys {
        if current_path != Some(key.path.as_str()) {
            if current_path.is_some() {
                out.push_str("\r\n");
            }
            out.push('[');
            out.push_str(&key.path);
            out.push_str("]\r\n");
            current_path = Some(key.path.as_str());
        }

        if let Some(line) = render_registry_key_line(key) {
            out.push_str(&line);
            out.push_str("\r\n");
        }
    }

    out
}

fn render_registry_key_line(key: &orchestrator_core::RegistryKey) -> Option<String> {
    let name = if key.name == "@" {
        "@".to_string()
    } else {
        format!("\"{}\"", escape_reg_string(&key.name))
    };

    let ty = key.value_type.trim().to_ascii_uppercase();
    let raw = key.value.trim();

    let rendered = match ty.as_str() {
        "REG_SZ" => format!("\"{}\"", escape_reg_string(raw)),
        "REG_DWORD" => {
            let value = raw.trim_start_matches("0x").to_ascii_lowercase();
            format!("dword:{value}")
        }
        "REG_BINARY" => format!("hex:{}", normalize_hex_for_reg(raw)),
        "REG_MULTI_SZ" => format!("hex(7):{}", normalize_hex_for_reg(raw)),
        "REG_EXPAND_SZ" => format!("hex(2):{}", normalize_hex_for_reg(raw)),
        "REG_QWORD" => format!("hex(b):{}", normalize_hex_for_reg(raw)),
        _ => return None,
    };

    Some(format!("{name}={rendered}"))
}

fn normalize_hex_for_reg(raw: &str) -> String {
    raw.split(',')
        .map(str::trim)
        .filter(|chunk| !chunk.is_empty())
        .collect::<Vec<_>>()
        .join(",")
}

fn escape_reg_string(raw: &str) -> String {
    raw.replace('\\', "\\\\").replace('"', "\\\"")
}

fn encode_utf16le_with_bom(raw: &str) -> Vec<u8> {
    let mut out = Vec::with_capacity(2 + raw.len() * 2);
    out.extend_from_slice(&[0xFF, 0xFE]);
    for unit in raw.encode_utf16() {
        out.extend_from_slice(&unit.to_le_bytes());
    }
    out
}

fn proton_root_from_script(proton_binary_path: &str) -> Option<String> {
    let proton_path = Path::new(proton_binary_path);
    let proton_dir = proton_path.parent()?;
    Some(proton_dir.to_string_lossy().into_owned())
}

fn proton_bin_dir_from_script(proton_binary_path: &str) -> Option<PathBuf> {
    let proton_path = Path::new(proton_binary_path);
    let proton_dir = proton_path.parent()?;

    for dist in ["files", "dist"] {
        let bin_dir = proton_dir.join(dist).join("bin");
        if bin_dir.is_dir() {
            return Some(bin_dir);
        }
    }

    None
}

fn adapt_prefix_setup_plan_for_runtime(
    plan: &PrefixSetupPlan,
    report: &DoctorReport,
    runtime: RuntimeCandidate,
) -> anyhow::Result<PrefixSetupPlan> {
    let mut out = plan.clone();

    if !matches!(
        runtime,
        RuntimeCandidate::ProtonNative | RuntimeCandidate::ProtonUmu
    ) {
        return Ok(out);
    }

    let proton = report
        .runtime
        .proton
        .clone()
        .ok_or_else(|| anyhow!("selected Proton runtime but proton path is missing"))?;

    for cmd in &mut out.commands {
        if cmd.program != "wineboot" {
            continue;
        }

        match runtime {
            RuntimeCandidate::ProtonNative => {
                let mut args = Vec::with_capacity(1 + cmd.args.len());
                args.push("run".to_string());
                args.push("wineboot".to_string());
                args.extend(cmd.args.clone());
                cmd.program = proton.clone();
                cmd.args = args;
            }
            RuntimeCandidate::ProtonUmu => {
                cmd.program = report.runtime.umu_run.clone().ok_or_else(|| {
                    anyhow!("selected ProtonUmu runtime but umu-run path is missing")
                })?;
                cmd.args = vec!["createprefix".to_string()];
            }
            RuntimeCandidate::Wine => {}
        }
    }

    Ok(out)
}
