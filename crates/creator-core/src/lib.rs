mod error;

use std::fs;
use std::path::{Component, Path, PathBuf};

use orchestrator_core::injector::{inject_from_parts, InjectOptions};
use orchestrator_core::GameConfig;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub use error::CreatorError;

#[derive(Debug, Clone)]
pub struct CreateOrchestratorRequest {
    pub base_binary_path: PathBuf,
    pub output_path: PathBuf,
    pub config: GameConfig,
    pub backup_existing: bool,
    pub make_executable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOrchestratorResult {
    pub output_path: String,
    pub config_size_bytes: usize,
    pub config_sha256_hex: String,
}

pub fn create_orchestrator_binary(
    request: &CreateOrchestratorRequest,
) -> Result<CreateOrchestratorResult, CreatorError> {
    validate_game_config_relative_paths(&request.config)?;

    let base_bytes = fs::read(&request.base_binary_path)?;
    let config_bytes = serde_json::to_vec_pretty(&request.config)?;

    let inject_result = inject_from_parts(
        &base_bytes,
        &config_bytes,
        &request.output_path,
        InjectOptions {
            backup_existing: request.backup_existing,
            make_executable: request.make_executable,
        },
    )?;

    Ok(CreateOrchestratorResult {
        output_path: inject_result.output_path.to_string_lossy().into_owned(),
        config_size_bytes: inject_result.config_len,
        config_sha256_hex: inject_result.config_sha256_hex,
    })
}

pub fn sha256_file(path: &Path) -> Result<String, CreatorError> {
    let bytes = fs::read(path)?;
    Ok(sha256_hex(&bytes))
}

pub fn to_relative_inside_game_root(
    game_root: &Path,
    candidate: &Path,
) -> Result<String, CreatorError> {
    let relative = if candidate.is_absolute() {
        candidate
            .strip_prefix(game_root)
            .map_err(|_| {
                CreatorError::PathOutsideGameRoot(candidate.to_string_lossy().into_owned())
            })?
            .to_path_buf()
    } else {
        candidate.to_path_buf()
    };

    validate_relative_path(&relative)?;
    Ok(path_to_unix_like(&relative))
}

pub fn validate_game_config_relative_paths(config: &GameConfig) -> Result<(), CreatorError> {
    validate_relative_path(Path::new(&config.relative_exe_path))?;

    for path in &config.integrity_files {
        validate_relative_path(Path::new(path))?;
    }

    for mount in &config.folder_mounts {
        validate_relative_path(Path::new(&mount.source_relative_path))?;
    }

    Ok(())
}

fn validate_relative_path(path: &Path) -> Result<(), CreatorError> {
    if path.is_absolute() {
        return Err(CreatorError::AbsolutePathNotAllowed(
            path.to_string_lossy().into_owned(),
        ));
    }

    for component in path.components() {
        if matches!(component, Component::ParentDir) {
            return Err(CreatorError::PathTraversalNotAllowed(
                path.to_string_lossy().into_owned(),
            ));
        }
    }

    Ok(())
}

fn path_to_unix_like(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::CurDir => None,
            Component::Normal(value) => Some(value.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<String>>()
        .join("/")
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest: [u8; 32] = hasher.finalize().into();
    let mut out = String::with_capacity(64);

    for byte in digest {
        out.push(hex_digit(byte >> 4));
        out.push(hex_digit(byte & 0x0f));
    }

    out
}

fn hex_digit(value: u8) -> char {
    match value {
        0..=9 => (b'0' + value) as char,
        _ => (b'a' + (value - 10)) as char,
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use orchestrator_core::config::*;

    use super::*;

    #[test]
    fn rejects_absolute_relative_exe_path() {
        let mut cfg = sample_config();
        cfg.relative_exe_path = "/tmp/game.exe".to_string();

        let err = validate_game_config_relative_paths(&cfg).expect_err("must reject absolute path");
        assert!(matches!(err, CreatorError::AbsolutePathNotAllowed(_)));
    }

    #[test]
    fn rejects_traversal_in_integrity_files() {
        let mut cfg = sample_config();
        cfg.integrity_files = vec!["../secret.dll".to_string()];

        let err = validate_game_config_relative_paths(&cfg).expect_err("must reject traversal");
        assert!(matches!(err, CreatorError::PathTraversalNotAllowed(_)));
    }

    #[test]
    fn keeps_relative_path_inside_root() {
        let root = Path::new("/games/sample");
        let relative =
            to_relative_inside_game_root(root, Path::new("data/game.exe")).expect("valid relative");
        assert_eq!(relative, "data/game.exe");
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
                },
                mangohud: FeatureState::OptionalOff,
                prime_offload: false,
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
                dll_overrides: vec![],
                auto_capture_mouse: FeatureState::OptionalOn,
                window_decorations: FeatureState::OptionalOn,
                window_manager_control: FeatureState::OptionalOn,
                virtual_desktop: VirtualDesktopConfig {
                    state: FeatureState::OptionalOff,
                    resolution: None,
                },
                desktop_integration: FeatureState::OptionalOn,
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
            scripts: ScriptsConfig {
                pre_launch: String::new(),
                post_launch: String::new(),
            },
        }
    }
}
