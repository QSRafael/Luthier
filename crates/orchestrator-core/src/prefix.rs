use std::env;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::config::{FeatureState, GameConfig};
use crate::error::OrchestratorError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PrefixSetupPlan {
    pub prefix_path: String,
    pub needs_init: bool,
    pub commands: Vec<PlannedCommand>,
    pub notes: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlannedCommand {
    pub name: String,
    pub program: String,
    pub args: Vec<String>,
    pub timeout_secs: u64,
    pub mandatory: bool,
}

pub fn prefix_path_for_hash(exe_hash: &str) -> Result<PathBuf, OrchestratorError> {
    let home = env::var_os("HOME").ok_or(OrchestratorError::MissingHomeDir)?;
    Ok(PathBuf::from(home)
        .join(".local/share/GameOrchestrator/prefixes")
        .join(exe_hash))
}

pub fn build_prefix_setup_plan(config: &GameConfig) -> Result<PrefixSetupPlan, OrchestratorError> {
    let prefix_path = prefix_path_for_hash(&config.exe_hash)?;
    let needs_init = !prefix_path.exists();

    let mut commands = Vec::new();
    let mut notes = Vec::new();

    if needs_init {
        commands.push(PlannedCommand {
            name: "wineboot-init".to_string(),
            program: "wineboot".to_string(),
            args: vec!["--init".to_string()],
            timeout_secs: 120,
            mandatory: true,
        });
    }

    if !config.dependencies.is_empty() {
        match config.requirements.winetricks {
            FeatureState::MandatoryOn | FeatureState::OptionalOn => {
                let mandatory = matches!(config.requirements.winetricks, FeatureState::MandatoryOn);
                let mut args = vec!["-q".to_string()];
                args.extend(config.dependencies.clone());

                commands.push(PlannedCommand {
                    name: "winetricks".to_string(),
                    program: "winetricks".to_string(),
                    args,
                    timeout_secs: 900,
                    mandatory,
                });
            }
            FeatureState::MandatoryOff => {
                notes.push(
                    "winetricks disabled by policy; dependencies list will not be installed"
                        .to_string(),
                );
            }
            FeatureState::OptionalOff => {
                notes.push(
                    "winetricks optional-off by default; dependencies list not installed unless override is provided"
                        .to_string(),
                );
            }
        }
    }

    if !config.registry_keys.is_empty() {
        notes.push("registry_keys present: apply after prefix init".to_string());
    }

    Ok(PrefixSetupPlan {
        prefix_path: path_to_string(&prefix_path),
        needs_init,
        commands,
        notes,
    })
}

pub fn base_env_for_prefix(prefix_path: &Path) -> Vec<(String, String)> {
    vec![
        ("WINEPREFIX".to_string(), path_to_string(prefix_path)),
        ("PROTON_VERB".to_string(), "run".to_string()),
    ]
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::*;
    use crate::config::*;

    #[test]
    fn plan_includes_winetricks_when_dependencies_exist() {
        let mut cfg = sample_config();
        cfg.dependencies = vec!["corefonts".to_string()];
        cfg.requirements.winetricks = FeatureState::MandatoryOn;

        let plan = build_prefix_setup_plan(&cfg).expect("build plan");

        assert!(plan.commands.iter().any(|cmd| cmd.program == "winetricks"));
        let cmd = plan
            .commands
            .iter()
            .find(|cmd| cmd.program == "winetricks")
            .expect("winetricks command exists");
        assert!(cmd.mandatory);
    }

    #[test]
    fn plan_skips_winetricks_when_policy_is_off() {
        let mut cfg = sample_config();
        cfg.dependencies = vec!["corefonts".to_string()];
        cfg.requirements.winetricks = FeatureState::OptionalOff;

        let plan = build_prefix_setup_plan(&cfg).expect("build plan");

        assert!(!plan.commands.iter().any(|cmd| cmd.program == "winetricks"));
        assert!(plan.notes.iter().any(|note| note.contains("optional-off")));
    }

    #[test]
    fn env_contains_wineprefix_and_proton_verb() {
        let env = base_env_for_prefix(Path::new("/tmp/prefix"));
        assert!(env.iter().any(|(k, _)| k == "WINEPREFIX"));
        assert!(env.iter().any(|(k, v)| k == "PROTON_VERB" && v == "run"));
    }

    fn sample_config() -> GameConfig {
        GameConfig {
            config_version: 1,
            created_by: "test".to_string(),
            game_name: "Sample Game".to_string(),
            exe_hash: "abc123".to_string(),
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
                battleye_runtime: FeatureState::OptionalOff,
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
            scripts: ScriptsConfig {
                pre_launch: String::new(),
                post_launch: String::new(),
            },
        }
    }
}
