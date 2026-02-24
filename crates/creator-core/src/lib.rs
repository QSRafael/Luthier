mod error;

use std::collections::HashSet;
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

    let raw = path_to_unix_like(&relative);
    normalize_relative_payload_path(&raw)
}

pub fn validate_game_config_relative_paths(config: &GameConfig) -> Result<(), CreatorError> {
    normalize_relative_payload_path(&config.relative_exe_path)?;

    for path in &config.integrity_files {
        normalize_relative_payload_path(path)?;
    }

    let mut seen_mount_targets = HashSet::new();
    for mount in &config.folder_mounts {
        normalize_relative_payload_path(&mount.source_relative_path)?;
        let normalized_target = normalize_windows_mount_target(&mount.target_windows_path)?;

        if !seen_mount_targets.insert(normalized_target.to_ascii_lowercase()) {
            return Err(CreatorError::DuplicateFolderMountTarget(
                mount.target_windows_path.clone(),
            ));
        }
    }

    Ok(())
}

fn normalize_relative_payload_path(raw: &str) -> Result<String, CreatorError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(CreatorError::InvalidRelativePath(raw.to_string()));
    }

    let normalized = trimmed.replace('\\', "/");
    if normalized.starts_with('/') || has_windows_drive_prefix(&normalized) {
        return Err(CreatorError::AbsolutePathNotAllowed(raw.to_string()));
    }

    let mut out = Vec::new();
    for part in normalized.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }

        if part == ".." {
            return Err(CreatorError::PathTraversalNotAllowed(raw.to_string()));
        }

        out.push(part);
    }

    if out.is_empty() {
        return Err(CreatorError::InvalidRelativePath(raw.to_string()));
    }

    Ok(out.join("/"))
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

fn has_windows_drive_prefix(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic()
}

fn normalize_windows_mount_target(raw: &str) -> Result<String, CreatorError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(CreatorError::InvalidFolderMountTarget(raw.to_string()));
    }

    if trimmed.contains('%') {
        return Err(CreatorError::InvalidFolderMountTarget(raw.to_string()));
    }

    if trimmed.starts_with("\\\\") || trimmed.starts_with("//") {
        return Err(CreatorError::InvalidFolderMountTarget(raw.to_string()));
    }

    let normalized = trimmed.replace('/', "\\");
    let bytes = normalized.as_bytes();
    if bytes.len() < 2 || bytes[1] != b':' || !bytes[0].is_ascii_alphabetic() {
        return Err(CreatorError::InvalidFolderMountTarget(raw.to_string()));
    }

    let drive = (bytes[0] as char).to_ascii_uppercase();
    let remainder = normalized[2..].trim_start_matches('\\');
    if remainder.is_empty() {
        return Err(CreatorError::InvalidFolderMountTarget(raw.to_string()));
    }

    let mut segments = Vec::new();
    for segment in remainder.split('\\') {
        if segment.is_empty() || segment == "." {
            continue;
        }

        if segment == ".." {
            return Err(CreatorError::InvalidFolderMountTarget(raw.to_string()));
        }

        segments.push(segment);
    }

    if segments.is_empty() {
        return Err(CreatorError::InvalidFolderMountTarget(raw.to_string()));
    }

    Ok(format!(r"{drive}:\{}", segments.join("\\")))
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
    fn rejects_windows_absolute_relative_exe_path() {
        let mut cfg = sample_config();
        cfg.relative_exe_path = r"C:\games\sample.exe".to_string();

        let err = validate_game_config_relative_paths(&cfg)
            .expect_err("must reject windows absolute path");
        assert!(matches!(err, CreatorError::AbsolutePathNotAllowed(_)));
    }

    #[test]
    fn rejects_backslash_traversal_in_integrity_files() {
        let mut cfg = sample_config();
        cfg.integrity_files = vec![r"..\secret.dll".to_string()];

        let err =
            validate_game_config_relative_paths(&cfg).expect_err("must reject backslash traversal");
        assert!(matches!(err, CreatorError::PathTraversalNotAllowed(_)));
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
        assert!(matches!(err, CreatorError::InvalidFolderMountTarget(_)));
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
        assert!(matches!(err, CreatorError::DuplicateFolderMountTarget(_)));
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
                auto_capture_mouse: FeatureState::OptionalOn,
                window_decorations: FeatureState::OptionalOn,
                window_manager_control: FeatureState::OptionalOn,
                virtual_desktop: VirtualDesktopConfig {
                    state: FeatureState::OptionalOff,
                    resolution: None,
                },
                screen_dpi: None,
                desktop_integration: FeatureState::OptionalOn,
                mime_associations: FeatureState::OptionalOff,
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
            scripts: ScriptsConfig {
                pre_launch: String::new(),
                post_launch: String::new(),
            },
        }
    }
}
