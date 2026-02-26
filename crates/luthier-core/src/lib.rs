mod application;
mod domain;
mod error;
mod infrastructure;
mod models;

use std::path::Path;

use luthier_orchestrator_core::GameConfig;

pub use error::ConfigValidationIssue;
pub use error::LuthierError;
pub use models::{CreateOrchestratorRequest, CreateOrchestratorResult};

pub fn create_orchestrator_binary(
    request: &CreateOrchestratorRequest,
) -> Result<CreateOrchestratorResult, LuthierError> {
    application::create_orchestrator_binary::create_orchestrator_binary(request)
}

pub fn sha256_file(path: &Path) -> Result<String, LuthierError> {
    application::hash::sha256_file(path)
}

pub fn to_relative_inside_game_root(
    game_root: &Path,
    candidate: &Path,
) -> Result<String, LuthierError> {
    domain::path_rules::to_relative_inside_game_root(game_root, candidate)
}

pub fn validate_game_config_relative_paths(config: &GameConfig) -> Result<(), LuthierError> {
    application::validate_game_config::validate_game_config_relative_paths(config)
}

pub fn validate_game_config(config: &GameConfig) -> Result<(), LuthierError> {
    application::validate_game_config::validate_game_config(config)
}

pub fn collect_game_config_validation_issues(config: &GameConfig) -> Vec<ConfigValidationIssue> {
    application::validate_game_config::collect_game_config_validation_issues(config)
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use luthier_orchestrator_core::config::*;

    use super::*;

    #[test]
    fn rejects_absolute_relative_exe_path() {
        let mut cfg = sample_config();
        cfg.relative_exe_path = "/tmp/game.exe".to_string();

        let err = validate_game_config_relative_paths(&cfg).expect_err("must reject absolute path");
        assert!(matches!(err, LuthierError::AbsolutePathNotAllowed(_)));
    }

    #[test]
    fn rejects_traversal_in_integrity_files() {
        let mut cfg = sample_config();
        cfg.integrity_files = vec!["../secret.dll".to_string()];

        let err = validate_game_config_relative_paths(&cfg).expect_err("must reject traversal");
        assert!(matches!(err, LuthierError::PathTraversalNotAllowed(_)));
    }

    #[test]
    fn rejects_windows_absolute_relative_exe_path() {
        let mut cfg = sample_config();
        cfg.relative_exe_path = r"C:\games\sample.exe".to_string();

        let err = validate_game_config_relative_paths(&cfg)
            .expect_err("must reject windows absolute path");
        assert!(matches!(err, LuthierError::AbsolutePathNotAllowed(_)));
    }

    #[test]
    fn rejects_backslash_traversal_in_integrity_files() {
        let mut cfg = sample_config();
        cfg.integrity_files = vec![r"..\secret.dll".to_string()];

        let err =
            validate_game_config_relative_paths(&cfg).expect_err("must reject backslash traversal");
        assert!(matches!(err, LuthierError::PathTraversalNotAllowed(_)));
    }

    #[test]
    fn rejects_invalid_folder_mount_target() {
        let mut cfg = sample_config();
        cfg.folder_mounts = vec![FolderMount {
            source_relative_path: "save".to_string(),
            target_windows_path: r"C:\users\%USERPROFILE%\Game".to_string(),
            create_source_if_missing: true,
        }];

        let err = validate_game_config_relative_paths(&cfg)
            .expect_err("must reject invalid mount target");
        assert!(matches!(err, LuthierError::InvalidFolderMountTarget(_)));
    }

    #[test]
    fn rejects_duplicate_folder_mount_target() {
        let mut cfg = sample_config();
        cfg.folder_mounts = vec![
            FolderMount {
                source_relative_path: "save_a".to_string(),
                target_windows_path: r"C:\users\steamuser\Documents\Game".to_string(),
                create_source_if_missing: true,
            },
            FolderMount {
                source_relative_path: "save_b".to_string(),
                target_windows_path: r"c:/users/steamuser/documents/game".to_string(),
                create_source_if_missing: true,
            },
        ];

        let err = validate_game_config_relative_paths(&cfg)
            .expect_err("must reject duplicate mount targets");
        assert!(matches!(err, LuthierError::DuplicateFolderMountTarget(_)));
    }

    #[test]
    fn keeps_relative_path_inside_root() {
        let root = Path::new("/games/sample");
        let relative =
            to_relative_inside_game_root(root, Path::new("data/game.exe")).expect("valid relative");
        assert_eq!(relative, "data/game.exe");
    }

    #[test]
    fn normalizes_backslash_relative_path_inside_root() {
        let root = Path::new("/games/sample");
        let relative = to_relative_inside_game_root(root, Path::new(r"data\bin\game.exe"))
            .expect("valid relative");
        assert_eq!(relative, "data/bin/game.exe");
    }

    fn sample_config() -> GameConfig {
        GameConfig {
            config_version: 1,
            created_by: "test".to_string(),
            game_name: "Sample".to_string(),
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
                auto_capture_mouse: luthier_orchestrator_core::WinecfgFeaturePolicy {
                    state: FeatureState::OptionalOn,
                    use_wine_default: true,
                },
                window_decorations: luthier_orchestrator_core::WinecfgFeaturePolicy {
                    state: FeatureState::OptionalOn,
                    use_wine_default: true,
                },
                window_manager_control: luthier_orchestrator_core::WinecfgFeaturePolicy {
                    state: FeatureState::OptionalOn,
                    use_wine_default: true,
                },
                virtual_desktop: VirtualDesktopConfig {
                    state: luthier_orchestrator_core::WinecfgFeaturePolicy {
                        state: FeatureState::OptionalOff,
                        use_wine_default: true,
                    },
                    resolution: None,
                },
                screen_dpi: None,
                desktop_integration: luthier_orchestrator_core::WinecfgFeaturePolicy {
                    state: FeatureState::OptionalOn,
                    use_wine_default: true,
                },
                mime_associations: luthier_orchestrator_core::WinecfgFeaturePolicy {
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
            integrity_files: vec!["./data/core.dll".to_string()],
            folder_mounts: vec![],
            splash: SplashConfig::default(),
            scripts: ScriptsConfig {
                pre_launch: String::new(),
                post_launch: String::new(),
            },
        }
    }

    #[test]
    fn collects_semantic_validation_issues() {
        let mut cfg = sample_config();
        cfg.game_name.clear();
        cfg.exe_hash = "123".to_string();
        cfg.runner.proton_version.clear();
        cfg.environment
            .custom_vars
            .insert("BAD KEY".to_string(), "1".to_string());

        let issues = collect_game_config_validation_issues(&cfg);
        let codes = issues
            .iter()
            .map(|issue| issue.code.as_str())
            .collect::<Vec<_>>();

        assert!(codes.contains(&"game_name_required"));
        assert!(codes.contains(&"exe_hash_invalid"));
        assert!(codes.contains(&"runner_proton_version_required"));
        assert!(codes.contains(&"env_var_name_invalid"));
    }
}
