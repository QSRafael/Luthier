use std::{fs, path::PathBuf};

use anyhow::{anyhow, Context};
use luthier_orchestrator_core::prefix::compact_exe_hash_key;
use luthier_orchestrator_core::{FeatureState, GameConfig};
use serde::{Deserialize, Serialize};

use crate::{cli::OptionalToggle, domain::feature_policy};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct RuntimeOverrides {
    pub mangohud: Option<bool>,
    pub gamescope: Option<bool>,
    pub gamemode: Option<bool>,
    pub umu: Option<bool>,
    pub winetricks: Option<bool>,
    pub steam_runtime: Option<bool>,
    pub prime_offload: Option<bool>,
    pub wine_wayland: Option<bool>,
    pub hdr: Option<bool>,
    pub auto_dxvk_nvapi: Option<bool>,
    pub easy_anti_cheat_runtime: Option<bool>,
    pub battleye_runtime: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ConfigFeatureView {
    pub feature: &'static str,
    pub policy_state: FeatureState,
    pub overridable: bool,
    pub default_enabled: bool,
    pub effective_enabled: bool,
    pub override_value: Option<bool>,
}

pub fn feature_enabled(state: FeatureState) -> bool {
    feature_policy::enabled(state)
}

pub fn feature_overridable(state: FeatureState) -> bool {
    feature_policy::overridable(state)
}

pub fn build_feature_view(
    feature: &'static str,
    policy_state: FeatureState,
    override_value: Option<bool>,
) -> ConfigFeatureView {
    ConfigFeatureView {
        feature,
        policy_state,
        overridable: feature_policy::overridable(policy_state),
        default_enabled: feature_policy::default_enabled(policy_state),
        effective_enabled: feature_policy::effective_enabled(policy_state, override_value),
        override_value,
    }
}

pub fn apply_toggle_request(
    feature_name: &str,
    state: FeatureState,
    requested: Option<OptionalToggle>,
    target: &mut Option<bool>,
) -> anyhow::Result<bool> {
    let Some(requested) = requested else {
        return Ok(false);
    };

    if !feature_policy::overridable(state) {
        return Err(anyhow!(
            "feature '{}' is not overridable with current policy",
            feature_name
        ));
    }

    Ok(set_optional_override(target, requested))
}

pub fn set_optional_override(target: &mut Option<bool>, requested: OptionalToggle) -> bool {
    let next = match requested {
        OptionalToggle::On => Some(true),
        OptionalToggle::Off => Some(false),
        OptionalToggle::Default => None,
    };

    let changed = *target != next;
    *target = next;
    changed
}

pub fn runtime_overrides_path(exe_hash: &str) -> anyhow::Result<PathBuf> {
    let home = std::env::var_os("HOME").ok_or_else(|| anyhow!("HOME is not set"))?;
    Ok(PathBuf::from(home)
        .join(".local/share/Luthier/overrides")
        .join(format!("{}.json", compact_exe_hash_key(exe_hash))))
}

pub fn load_runtime_overrides(exe_hash: &str) -> anyhow::Result<RuntimeOverrides> {
    let path = runtime_overrides_path(exe_hash)?;
    if !path.exists() {
        return Ok(RuntimeOverrides::default());
    }

    let raw = fs::read_to_string(&path)
        .with_context(|| format!("failed to read runtime overrides at {}", path.display()))?;
    let parsed = serde_json::from_str::<RuntimeOverrides>(&raw)
        .with_context(|| format!("invalid runtime overrides at {}", path.display()))?;
    Ok(parsed)
}

pub fn save_runtime_overrides(
    exe_hash: &str,
    overrides: &RuntimeOverrides,
) -> anyhow::Result<PathBuf> {
    let path = runtime_overrides_path(exe_hash)?;
    let parent = path
        .parent()
        .ok_or_else(|| anyhow!("runtime override path has no parent"))?;
    fs::create_dir_all(parent)
        .with_context(|| format!("failed to create overrides directory {}", parent.display()))?;

    let payload =
        serde_json::to_vec_pretty(overrides).context("failed to serialize runtime overrides")?;
    fs::write(&path, payload)
        .with_context(|| format!("failed to write runtime overrides to {}", path.display()))?;
    Ok(path)
}

pub fn apply_runtime_overrides(config: &mut GameConfig, overrides: &RuntimeOverrides) {
    apply_optional_override(&mut config.environment.gamemode, overrides.gamemode);
    apply_optional_override(&mut config.environment.mangohud, overrides.mangohud);
    apply_optional_override(&mut config.requirements.mangohud, overrides.mangohud);
    apply_optional_override(&mut config.requirements.gamemode, overrides.gamemode);
    apply_optional_override(&mut config.environment.gamescope.state, overrides.gamescope);
    apply_optional_override(&mut config.requirements.gamescope, overrides.gamescope);
    apply_optional_override(&mut config.requirements.umu, overrides.umu);
    apply_optional_override(&mut config.requirements.winetricks, overrides.winetricks);
    apply_optional_override(
        &mut config.requirements.steam_runtime,
        overrides.steam_runtime,
    );
    apply_optional_override(
        &mut config.environment.prime_offload,
        overrides.prime_offload,
    );
    apply_optional_override(
        &mut config.compatibility.wine_wayland,
        overrides.wine_wayland,
    );
    apply_optional_override(&mut config.compatibility.hdr, overrides.hdr);
    apply_optional_override(
        &mut config.compatibility.auto_dxvk_nvapi,
        overrides.auto_dxvk_nvapi,
    );
    apply_optional_override(
        &mut config.compatibility.easy_anti_cheat_runtime,
        overrides.easy_anti_cheat_runtime,
    );
    apply_optional_override(
        &mut config.compatibility.battleye_runtime,
        overrides.battleye_runtime,
    );
}

fn apply_optional_override(state: &mut FeatureState, override_value: Option<bool>) {
    let Some(override_value) = override_value else {
        return;
    };

    if !feature_policy::overridable(*state) {
        return;
    }

    *state = if override_value {
        FeatureState::OptionalOn
    } else {
        FeatureState::OptionalOff
    };
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use luthier_orchestrator_core::{
        CompatibilityConfig, EnvConfig, FeatureState, GameConfig, GamescopeConfig,
        RequirementsConfig, RunnerConfig, RuntimeCandidate, RuntimePolicy, RuntimePreference,
        ScriptsConfig, SplashConfig, VirtualDesktopConfig, WinecfgConfig, WinecfgFeaturePolicy,
    };

    use super::*;

    #[test]
    fn set_optional_override_cycles_on_off_default() {
        let mut target = None;

        assert!(set_optional_override(&mut target, OptionalToggle::On));
        assert_eq!(target, Some(true));

        assert!(!set_optional_override(&mut target, OptionalToggle::On));
        assert_eq!(target, Some(true));

        assert!(set_optional_override(&mut target, OptionalToggle::Off));
        assert_eq!(target, Some(false));

        assert!(set_optional_override(&mut target, OptionalToggle::Default));
        assert_eq!(target, None);

        assert!(!set_optional_override(&mut target, OptionalToggle::Default));
        assert_eq!(target, None);
    }

    #[test]
    fn apply_toggle_request_allows_optional_and_blocks_mandatory_states() {
        let mut target = None;

        assert!(matches!(
            apply_toggle_request(
                "steam_runtime",
                FeatureState::OptionalOff,
                Some(OptionalToggle::On),
                &mut target
            ),
            Ok(true)
        ));
        assert_eq!(target, Some(true));

        assert!(matches!(
            apply_toggle_request(
                "steam_runtime",
                FeatureState::OptionalOff,
                Some(OptionalToggle::Default),
                &mut target
            ),
            Ok(true)
        ));
        assert_eq!(target, None);

        match apply_toggle_request(
            "steam_runtime",
            FeatureState::MandatoryOn,
            Some(OptionalToggle::Off),
            &mut target,
        ) {
            Ok(_) => panic!("mandatory state must reject override requests"),
            Err(err) => {
                let message = err.to_string();
                assert!(message.contains("feature 'steam_runtime'"));
                assert!(message.contains("not overridable"));
            }
        }
    }

    #[test]
    fn apply_runtime_overrides_updates_runtime_environment_and_compatibility_fields() {
        let mut config = sample_config();
        let runtime_primary_before = config.requirements.runtime.primary;
        let runtime_strict_before = config.requirements.runtime.strict;
        let runtime_fallback_before = config.requirements.runtime.fallback_order.clone();

        let overrides = RuntimeOverrides {
            mangohud: Some(true),
            gamescope: Some(true),
            gamemode: Some(false),
            umu: Some(false),
            winetricks: Some(true),
            steam_runtime: Some(true),
            prime_offload: Some(true),
            wine_wayland: Some(true),
            hdr: Some(true),
            auto_dxvk_nvapi: Some(true),
            easy_anti_cheat_runtime: Some(true),
            battleye_runtime: Some(false),
        };

        apply_runtime_overrides(&mut config, &overrides);

        assert_eq!(config.environment.mangohud, FeatureState::OptionalOn);
        assert_eq!(config.requirements.mangohud, FeatureState::OptionalOn);
        assert_eq!(config.environment.gamescope.state, FeatureState::OptionalOn);
        assert_eq!(config.requirements.gamescope, FeatureState::OptionalOn);
        assert_eq!(config.environment.gamemode, FeatureState::OptionalOff);
        assert_eq!(config.requirements.gamemode, FeatureState::OptionalOff);
        assert_eq!(config.requirements.umu, FeatureState::OptionalOff);
        assert_eq!(config.requirements.winetricks, FeatureState::OptionalOn);
        assert_eq!(config.requirements.steam_runtime, FeatureState::OptionalOn);
        assert_eq!(config.environment.prime_offload, FeatureState::OptionalOn);
        assert_eq!(config.compatibility.wine_wayland, FeatureState::OptionalOn);
        assert_eq!(config.compatibility.hdr, FeatureState::OptionalOn);
        assert_eq!(
            config.compatibility.auto_dxvk_nvapi,
            FeatureState::OptionalOn
        );
        assert_eq!(
            config.compatibility.easy_anti_cheat_runtime,
            FeatureState::OptionalOn
        );
        assert_eq!(
            config.compatibility.battleye_runtime,
            FeatureState::OptionalOff
        );

        assert_eq!(config.requirements.runtime.primary, runtime_primary_before);
        assert_eq!(config.requirements.runtime.strict, runtime_strict_before);
        assert_eq!(
            config.requirements.runtime.fallback_order,
            runtime_fallback_before
        );
    }

    #[test]
    fn apply_runtime_overrides_ignores_mandatory_feature_states() {
        let mut config = sample_config();
        config.environment.gamescope.state = FeatureState::MandatoryOn;
        config.requirements.gamescope = FeatureState::MandatoryOff;
        config.environment.prime_offload = FeatureState::MandatoryOff;
        config.compatibility.hdr = FeatureState::MandatoryOn;
        config.requirements.umu = FeatureState::MandatoryOn;
        config.requirements.steam_runtime = FeatureState::MandatoryOff;
        config.requirements.winetricks = FeatureState::MandatoryOff;

        let overrides = RuntimeOverrides {
            gamescope: Some(false),
            prime_offload: Some(true),
            hdr: Some(false),
            umu: Some(false),
            steam_runtime: Some(true),
            winetricks: Some(true),
            mangohud: Some(true),
            ..RuntimeOverrides::default()
        };

        apply_runtime_overrides(&mut config, &overrides);

        assert_eq!(
            config.environment.gamescope.state,
            FeatureState::MandatoryOn
        );
        assert_eq!(config.requirements.gamescope, FeatureState::MandatoryOff);
        assert_eq!(config.environment.prime_offload, FeatureState::MandatoryOff);
        assert_eq!(config.compatibility.hdr, FeatureState::MandatoryOn);
        assert_eq!(config.requirements.umu, FeatureState::MandatoryOn);
        assert_eq!(
            config.requirements.steam_runtime,
            FeatureState::MandatoryOff
        );
        assert_eq!(config.requirements.winetricks, FeatureState::MandatoryOff);

        assert_eq!(config.environment.mangohud, FeatureState::OptionalOn);
        assert_eq!(config.requirements.mangohud, FeatureState::OptionalOn);
    }

    #[test]
    fn runtime_overrides_supports_minimal_json_serialization_roundtrip() {
        let parsed = serde_json::from_str::<RuntimeOverrides>(
            r#"{"steam_runtime":true,"hdr":false,"prime_offload":true}"#,
        );
        assert!(parsed.is_ok());
        let parsed = parsed.unwrap_or_default();

        assert_eq!(parsed.steam_runtime, Some(true));
        assert_eq!(parsed.hdr, Some(false));
        assert_eq!(parsed.prime_offload, Some(true));
        assert_eq!(parsed.gamescope, None);
        assert_eq!(parsed.umu, None);

        let serialized = serde_json::to_value(&parsed);
        assert!(serialized.is_ok());
        let serialized = serialized.unwrap_or(serde_json::Value::Null);
        let serde_json::Value::Object(map) = serialized else {
            panic!("serialized runtime overrides should be a JSON object");
        };

        assert_eq!(
            map.get("steam_runtime"),
            Some(&serde_json::Value::Bool(true))
        );
        assert_eq!(map.get("hdr"), Some(&serde_json::Value::Bool(false)));
        assert_eq!(
            map.get("prime_offload"),
            Some(&serde_json::Value::Bool(true))
        );
    }

    fn sample_config() -> GameConfig {
        GameConfig {
            config_version: 1,
            created_by: "test".to_string(),
            game_name: "Sample Game".to_string(),
            exe_hash: "runtime-override-hash".to_string(),
            relative_exe_path: "./game.exe".to_string(),
            launch_args: vec![],
            runner: RunnerConfig {
                proton_version: "GE-Proton9-10".to_string(),
                auto_update: true,
                esync: true,
                fsync: true,
                runtime_preference: RuntimePreference::Auto,
            },
            environment: EnvConfig {
                gamemode: FeatureState::OptionalOn,
                gamescope: GamescopeConfig {
                    state: FeatureState::OptionalOff,
                    resolution: None,
                    fsr: false,
                    game_width: String::new(),
                    game_height: String::new(),
                    output_width: String::new(),
                    output_height: String::new(),
                    upscale_method: "fsr".to_string(),
                    window_type: "fullscreen".to_string(),
                    enable_limiter: false,
                    fps_limiter: String::new(),
                    fps_limiter_no_focus: String::new(),
                    force_grab_cursor: false,
                    additional_options: String::new(),
                },
                mangohud: FeatureState::OptionalOff,
                prime_offload: FeatureState::OptionalOff,
                custom_vars: HashMap::new(),
            },
            compatibility: CompatibilityConfig {
                wine_wayland: FeatureState::OptionalOff,
                hdr: FeatureState::OptionalOff,
                auto_dxvk_nvapi: FeatureState::OptionalOff,
                easy_anti_cheat_runtime: FeatureState::OptionalOff,
                battleye_runtime: FeatureState::OptionalOn,
                staging: FeatureState::OptionalOff,
                wrapper_commands: vec![],
            },
            winecfg: WinecfgConfig {
                windows_version: None,
                dll_overrides: vec![],
                auto_capture_mouse: WinecfgFeaturePolicy {
                    state: FeatureState::OptionalOn,
                    use_wine_default: true,
                },
                window_decorations: WinecfgFeaturePolicy {
                    state: FeatureState::OptionalOn,
                    use_wine_default: true,
                },
                window_manager_control: WinecfgFeaturePolicy {
                    state: FeatureState::OptionalOn,
                    use_wine_default: true,
                },
                virtual_desktop: VirtualDesktopConfig {
                    state: WinecfgFeaturePolicy {
                        state: FeatureState::OptionalOff,
                        use_wine_default: true,
                    },
                    resolution: None,
                },
                screen_dpi: None,
                desktop_integration: WinecfgFeaturePolicy {
                    state: FeatureState::OptionalOn,
                    use_wine_default: true,
                },
                mime_associations: WinecfgFeaturePolicy {
                    state: FeatureState::OptionalOff,
                    use_wine_default: true,
                },
                desktop_folders: vec![],
                drives: vec![],
                audio_driver: None,
            },
            dependencies: vec![],
            extra_system_dependencies: vec![],
            requirements: RequirementsConfig {
                runtime: RuntimePolicy {
                    strict: false,
                    primary: RuntimeCandidate::ProtonNative,
                    fallback_order: vec![RuntimeCandidate::Wine],
                },
                umu: FeatureState::OptionalOn,
                winetricks: FeatureState::OptionalOff,
                gamescope: FeatureState::OptionalOff,
                gamemode: FeatureState::OptionalOn,
                mangohud: FeatureState::OptionalOff,
                steam_runtime: FeatureState::OptionalOff,
            },
            registry_keys: vec![],
            integrity_files: vec![],
            folder_mounts: vec![],
            splash: SplashConfig::default(),
            scripts: ScriptsConfig {
                pre_launch: String::new(),
                post_launch: String::new(),
            },
        }
    }
}
