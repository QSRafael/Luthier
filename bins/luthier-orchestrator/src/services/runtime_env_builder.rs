use std::path::{Path, PathBuf};

use anyhow::anyhow;
use luthier_orchestrator_core::{
    doctor::DoctorReport,
    prefix::base_env_for_prefix,
    GameConfig, RuntimeCandidate,
};

use crate::overrides::feature_enabled;

pub type EnvPairs = Vec<(String, String)>;

pub fn build_launch_runtime_env(
    config: &GameConfig,
    report: &DoctorReport,
    game_root: &Path,
    prefix_path: &Path,
) -> anyhow::Result<EnvPairs> {
    let selected_runtime = selected_runtime_from_report(report)?;
    let effective_prefix_path = effective_prefix_path_for_runtime(prefix_path, selected_runtime);
    let mut env_pairs = base_env_for_prefix(&effective_prefix_path);

    prepare_common_runtime_env(
        &mut env_pairs,
        config,
        report,
        selected_runtime,
        prefix_path,
        Some(game_root),
        true,
    );

    apply_prime_offload_env_if_enabled(&mut env_pairs, config);
    apply_custom_env_vars(&mut env_pairs, config);

    Ok(env_pairs)
}

pub fn build_winecfg_runtime_env(
    config: &GameConfig,
    report: &DoctorReport,
    prefix_path: &Path,
) -> anyhow::Result<EnvPairs> {
    let selected_runtime = selected_runtime_from_report(report)?;
    let effective_prefix_path = effective_prefix_path_for_runtime(prefix_path, selected_runtime);
    let mut env_pairs = base_env_for_prefix(&effective_prefix_path);

    prepare_common_runtime_env(
        &mut env_pairs,
        config,
        report,
        selected_runtime,
        prefix_path,
        None,
        false,
    );

    apply_prime_offload_env_if_enabled(&mut env_pairs, config);
    apply_custom_env_vars(&mut env_pairs, config);

    Ok(env_pairs)
}

pub fn build_prefix_setup_runtime_env(
    config: &GameConfig,
    report: &DoctorReport,
    prefix_root_path: &Path,
) -> anyhow::Result<(EnvPairs, PathBuf)> {
    let runtime = selected_runtime_from_report(report)?;
    let effective_prefix_path = effective_prefix_path_for_runtime(prefix_root_path, runtime);
    let mut env = base_env_for_prefix(&effective_prefix_path);

    if matches!(runtime, RuntimeCandidate::ProtonUmu | RuntimeCandidate::ProtonNative) {
        remove_env(&mut env, "PROTON_VERB");
    }

    // Avoid wine gecko/mono popup dialogs during automated prefix bootstrap.
    upsert_env(&mut env, "WINEDLLOVERRIDES", "mscoree,mshtml=d");

    if matches!(runtime, RuntimeCandidate::ProtonNative | RuntimeCandidate::ProtonUmu) {
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

                for (name, file) in [("WINE", "wine"), ("WINE64", "wine64"), ("WINESERVER", "wineserver")] {
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

    Ok((env, effective_prefix_path))
}

pub fn effective_prefix_path_for_runtime(prefix_root: &Path, runtime: RuntimeCandidate) -> PathBuf {
    match runtime {
        RuntimeCandidate::ProtonNative | RuntimeCandidate::ProtonUmu => prefix_root.join("pfx"),
        RuntimeCandidate::Wine => prefix_root.to_path_buf(),
    }
}

pub fn upsert_env(
    env_pairs: &mut EnvPairs,
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

pub fn remove_env(env_pairs: &mut EnvPairs, key: &str) {
    env_pairs.retain(|(existing_key, _)| existing_key != key);
}

pub fn prepend_path_env(env_pairs: &mut EnvPairs, prefix: &Path) {
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

pub fn is_protected_env_key(key: &str) -> bool {
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

pub fn apply_heroic_like_runtime_env_defaults(
    env_pairs: &mut EnvPairs,
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

fn selected_runtime_from_report(report: &DoctorReport) -> anyhow::Result<RuntimeCandidate> {
    report
        .runtime
        .selected_runtime
        .ok_or_else(|| anyhow!("doctor did not select a runtime"))
}

fn prepare_common_runtime_env(
    env_pairs: &mut EnvPairs,
    config: &GameConfig,
    report: &DoctorReport,
    selected_runtime: RuntimeCandidate,
    prefix_path: &Path,
    game_install_path: Option<&Path>,
    set_ld_preload_default: bool,
) {
    if matches!(
        selected_runtime,
        RuntimeCandidate::ProtonUmu | RuntimeCandidate::ProtonNative
    ) {
        remove_env(env_pairs, "PROTON_VERB");
    }

    if matches!(
        selected_runtime,
        RuntimeCandidate::ProtonUmu | RuntimeCandidate::ProtonNative
    ) {
        upsert_env(
            env_pairs,
            "STEAM_COMPAT_DATA_PATH",
            prefix_path.to_string_lossy().into_owned(),
        );

        if let Some(proton_path) = &report.runtime.proton {
            if let Some(steam_client_path) = derive_steam_client_install_path(proton_path) {
                upsert_env(
                    env_pairs,
                    "STEAM_COMPAT_CLIENT_INSTALL_PATH",
                    steam_client_path,
                );
            }
        }
    }

    if matches!(selected_runtime, RuntimeCandidate::ProtonUmu) {
        if let Some(proton_path) = &report.runtime.proton {
            if let Some(proton_root) = proton_root_from_script(proton_path) {
                upsert_env(env_pairs, "PROTONPATH", proton_root);
            }
        }
    }

    apply_heroic_like_runtime_env_defaults(
        env_pairs,
        config,
        report,
        selected_runtime,
        game_install_path,
        set_ld_preload_default,
    );
}

fn apply_prime_offload_env_if_enabled(env_pairs: &mut EnvPairs, config: &GameConfig) {
    if config.environment.prime_offload.is_enabled() {
        upsert_env(env_pairs, "__NV_PRIME_RENDER_OFFLOAD", "1");
        upsert_env(env_pairs, "__GLX_VENDOR_LIBRARY_NAME", "nvidia");
        upsert_env(env_pairs, "DRI_PRIME", "1");
    }
}

fn apply_custom_env_vars(env_pairs: &mut EnvPairs, config: &GameConfig) {
    for (key, value) in &config.environment.custom_vars {
        if is_protected_env_key(key) {
            continue;
        }
        upsert_env(env_pairs, key, value);
    }
}

fn apply_proton_feature_envs(env_pairs: &mut EnvPairs, config: &GameConfig) {
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

fn apply_wine_feature_envs(env_pairs: &mut EnvPairs, config: &GameConfig) {
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
    env_pairs: &mut EnvPairs,
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
