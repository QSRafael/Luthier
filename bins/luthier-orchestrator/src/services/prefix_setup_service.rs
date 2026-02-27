use std::{
    fs,
    path::{Path, PathBuf},
};

use anyhow::anyhow;
use luthier_orchestrator_core::{
    doctor::DoctorReport,
    prefix::{base_env_for_prefix, PrefixSetupPlan},
    GameConfig, RuntimeCandidate,
};

use crate::{
    application::runtime_overrides::feature_enabled, domain::models::PrefixSetupExecutionContext,
};

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
    if matches!(
        runtime,
        RuntimeCandidate::ProtonUmu | RuntimeCandidate::ProtonNative
    ) {
        remove_env(&mut env, "PROTON_VERB");
    }

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

    let mut filtered_plan = plan.clone();
    filter_installed_winetricks_verbs(&mut filtered_plan, &effective_prefix_path);
    let adapted_plan = adapt_prefix_setup_plan_for_runtime(&filtered_plan, report, runtime)?;

    Ok(PrefixSetupExecutionContext {
        plan: adapted_plan,
        env,
        prefix_root_path,
        effective_prefix_path,
    })
}

pub fn effective_prefix_path_for_runtime(prefix_root: &Path, runtime: RuntimeCandidate) -> PathBuf {
    match runtime {
        RuntimeCandidate::ProtonNative | RuntimeCandidate::ProtonUmu => prefix_root.join("pfx"),
        RuntimeCandidate::Wine => prefix_root.to_path_buf(),
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

fn dependency_path(report: &DoctorReport, name: &str) -> Option<String> {
    report
        .dependencies
        .iter()
        .find(|dep| dep.name == name && dep.found)
        .and_then(|dep| dep.resolved_path.clone())
}

fn heroic_steam_game_id(config: &GameConfig) -> String {
    let suffix = if config.exe_hash.trim().is_empty() {
        "0"
    } else {
        config.exe_hash.trim()
    };

    format!("heroic-{suffix}")
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
    let umu_run =
        if matches!(runtime, RuntimeCandidate::ProtonUmu) {
            Some(
                report.runtime.umu_run.clone().ok_or_else(|| {
                    anyhow!("selected ProtonUmu runtime but umu-run path is missing")
                })?,
            )
        } else {
            None
        };

    for cmd in &mut out.commands {
        if cmd.program == "wineboot" {
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
                    cmd.program = umu_run.clone().ok_or_else(|| {
                        anyhow!("selected ProtonUmu runtime but umu-run path is missing")
                    })?;
                    cmd.args = vec!["createprefix".to_string()];
                }
                RuntimeCandidate::Wine => {}
            }
            continue;
        }

        if cmd.program == "winetricks" && matches!(runtime, RuntimeCandidate::ProtonUmu) {
            let mut args = cmd.args.clone();
            // Heroic removes -q when routing winetricks through umu-run.
            args.retain(|arg| arg != "-q");
            args.insert(0, "winetricks".to_string());
            cmd.program = umu_run
                .clone()
                .ok_or_else(|| anyhow!("selected ProtonUmu runtime but umu-run path is missing"))?;
            cmd.args = args;
        }
    }

    Ok(out)
}
