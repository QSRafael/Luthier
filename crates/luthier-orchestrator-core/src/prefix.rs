use std::env;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::config::{FeatureState, GameConfig};
use crate::error::OrchestratorError;

const PREFIX_HASH_KEY_LEN: usize = 12;

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
    let prefixes_dir = PathBuf::from(home).join(".local/share/Luthier/prefixes");
    let short_key = compact_exe_hash_key(exe_hash);
    Ok(prefixes_dir.join(short_key))
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

pub fn compact_exe_hash_key(raw_hash: &str) -> String {
    let trimmed = raw_hash.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    let is_hex = trimmed.bytes().all(|byte| byte.is_ascii_hexdigit());

    if is_hex && trimmed.len() > PREFIX_HASH_KEY_LEN {
        trimmed[..PREFIX_HASH_KEY_LEN].to_string()
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::fs;
    use std::path::PathBuf;

    use super::*;
    use crate::config::*;

    #[test]
    fn build_prefix_setup_plan_generates_expected_commands_and_flags_when_enabled() {
        let mut cfg = sample_config();
        cfg.exe_hash = "luthier-test-prefix-plan-missing-enabled-001".to_string();
        remove_prefix_for_hash(&cfg.exe_hash);
        cfg.dependencies = vec!["corefonts".to_string(), "vcrun2019".to_string()];
        cfg.requirements.winetricks = FeatureState::MandatoryOn;

        let plan = build_prefix_setup_plan(&cfg).expect("build plan");

        assert!(plan.needs_init);
        assert_eq!(plan.commands.len(), 2);

        let wineboot = find_command(&plan, "wineboot-init");
        assert_eq!(wineboot.program, "wineboot");
        assert_eq!(wineboot.args, vec!["--init"]);
        assert_eq!(wineboot.timeout_secs, 120);
        assert!(wineboot.mandatory);

        let winetricks = find_command(&plan, "winetricks");
        assert_eq!(winetricks.program, "winetricks");
        assert_eq!(winetricks.args, vec!["-q", "corefonts", "vcrun2019"]);
        assert_eq!(winetricks.timeout_secs, 900);
        assert!(winetricks.mandatory);
    }

    #[test]
    fn build_prefix_setup_plan_marks_winetricks_optional_when_policy_optional_on() {
        let mut cfg = sample_config();
        cfg.exe_hash = "luthier-test-prefix-plan-missing-optional-on-001".to_string();
        remove_prefix_for_hash(&cfg.exe_hash);
        cfg.dependencies = vec!["corefonts".to_string()];
        cfg.requirements.winetricks = FeatureState::OptionalOn;

        let plan = build_prefix_setup_plan(&cfg).expect("build plan");

        let winetricks = find_command(&plan, "winetricks");
        assert!(!winetricks.mandatory);
        assert_eq!(winetricks.args, vec!["-q", "corefonts"]);
    }

    #[test]
    fn build_prefix_setup_plan_skips_winetricks_and_adds_policy_note_when_off() {
        let mut cfg = sample_config();
        cfg.exe_hash = "luthier-test-prefix-plan-missing-optional-off-001".to_string();
        remove_prefix_for_hash(&cfg.exe_hash);
        cfg.dependencies = vec!["corefonts".to_string()];
        cfg.requirements.winetricks = FeatureState::OptionalOff;

        let plan = build_prefix_setup_plan(&cfg).expect("build plan");

        assert!(plan.needs_init);
        assert!(plan.commands.iter().all(|cmd| cmd.name != "winetricks"));
        assert!(plan.notes.iter().any(|note| note.contains("optional-off")));
    }

    #[test]
    fn build_prefix_setup_plan_skips_winetricks_and_adds_policy_note_when_mandatory_off() {
        let mut cfg = sample_config();
        cfg.exe_hash = "luthier-test-prefix-plan-missing-mandatory-off-001".to_string();
        remove_prefix_for_hash(&cfg.exe_hash);
        cfg.dependencies = vec!["corefonts".to_string()];
        cfg.requirements.winetricks = FeatureState::MandatoryOff;

        let plan = build_prefix_setup_plan(&cfg).expect("build plan");

        assert!(plan.commands.iter().all(|cmd| cmd.name != "winetricks"));
        assert!(plan
            .notes
            .iter()
            .any(|note| note.contains("disabled by policy")));
    }

    #[test]
    fn build_prefix_setup_plan_skips_wineboot_init_when_prefix_already_exists() {
        let mut cfg = sample_config();
        cfg.exe_hash = "luthier-test-prefix-plan-existing-prefix-001".to_string();
        cfg.dependencies.clear();
        cfg.requirements.winetricks = FeatureState::OptionalOff;

        let prefix_path = prefix_path_for_hash(&cfg.exe_hash).expect("prefix path");
        remove_prefix_path(&prefix_path);
        fs::create_dir_all(&prefix_path).expect("create existing prefix path");
        let _cleanup = PrefixPathCleanup(prefix_path.clone());

        let plan = build_prefix_setup_plan(&cfg).expect("build plan");

        assert!(!plan.needs_init);
        assert!(!plan.commands.iter().any(|cmd| cmd.name == "wineboot-init"));
        assert_eq!(plan.prefix_path, prefix_path.to_string_lossy());
    }

    #[test]
    fn build_prefix_setup_plan_adds_registry_note_when_registry_keys_exist() {
        let mut cfg = sample_config();
        cfg.exe_hash = "luthier-test-prefix-plan-registry-note-001".to_string();
        remove_prefix_for_hash(&cfg.exe_hash);
        cfg.registry_keys.push(RegistryKey {
            path: r"HKCU\Software\Game".to_string(),
            name: "InstallDir".to_string(),
            value_type: "REG_SZ".to_string(),
            value: "C:\\Game".to_string(),
        });

        let plan = build_prefix_setup_plan(&cfg).expect("build plan");
        assert!(plan
            .notes
            .iter()
            .any(|note| note.contains("registry_keys present")));
    }

    #[test]
    fn env_contains_wineprefix_and_proton_verb() {
        let env = base_env_for_prefix(Path::new("/tmp/prefix"));
        assert!(env.iter().any(|(k, _)| k == "WINEPREFIX"));
        assert!(env.iter().any(|(k, v)| k == "PROTON_VERB" && v == "run"));
    }

    #[test]
    fn compact_exe_hash_key_trims_and_truncates_hex_values() {
        let key = compact_exe_hash_key(
            "  D21D0173C3028C190055AE1F14F9A4C282E8E58318975FC5D4CEFDEB61A15DF9  ",
        );
        assert_eq!(key, "D21D0173C302");
    }

    #[test]
    fn compact_exe_hash_key_keeps_short_hex_values_and_non_hex_inputs() {
        assert_eq!(compact_exe_hash_key("abc123"), "abc123");
        assert_eq!(compact_exe_hash_key("<exe_hash>"), "<exe_hash>");
        assert_eq!(
            compact_exe_hash_key("prefix-not-hex-0123456789abcdef"),
            "prefix-not-hex-0123456789abcdef"
        );
    }

    #[test]
    fn compact_exe_hash_key_returns_empty_for_blank_input() {
        assert_eq!(compact_exe_hash_key("   "), "");
    }

    fn find_command<'a>(plan: &'a PrefixSetupPlan, name: &str) -> &'a PlannedCommand {
        plan.commands
            .iter()
            .find(|cmd| cmd.name == name)
            .expect("planned command not found")
    }

    fn remove_prefix_for_hash(exe_hash: &str) {
        let path = prefix_path_for_hash(exe_hash).expect("prefix path");
        remove_prefix_path(&path);
    }

    fn remove_prefix_path(path: &Path) {
        if path.exists() {
            let _ = fs::remove_dir_all(path);
        }
    }

    struct PrefixPathCleanup(PathBuf);

    impl Drop for PrefixPathCleanup {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
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
            splash: SplashConfig::default(),
            scripts: ScriptsConfig {
                pre_launch: String::new(),
                post_launch: String::new(),
            },
        }
    }
}
