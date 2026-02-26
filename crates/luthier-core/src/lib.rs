mod error;

use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};

use luthier_orchestrator_core::injector::{inject_from_parts, InjectOptions};
use luthier_orchestrator_core::GameConfig;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub use error::ConfigValidationIssue;
pub use error::LuthierError;

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
) -> Result<CreateOrchestratorResult, LuthierError> {
    validate_game_config(&request.config)?;

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

pub fn sha256_file(path: &Path) -> Result<String, LuthierError> {
    let bytes = fs::read(path)?;
    Ok(sha256_hex(&bytes))
}

pub fn to_relative_inside_game_root(
    game_root: &Path,
    candidate: &Path,
) -> Result<String, LuthierError> {
    let relative = if candidate.is_absolute() {
        candidate
            .strip_prefix(game_root)
            .map_err(|_| {
                LuthierError::PathOutsideGameRoot(candidate.to_string_lossy().into_owned())
            })?
            .to_path_buf()
    } else {
        candidate.to_path_buf()
    };

    let raw = path_to_unix_like(&relative);
    normalize_relative_payload_path(&raw)
}

pub fn validate_game_config_relative_paths(config: &GameConfig) -> Result<(), LuthierError> {
    normalize_relative_payload_path(&config.relative_exe_path)?;

    for path in &config.integrity_files {
        normalize_relative_payload_path(path)?;
    }

    let mut seen_mount_targets = HashSet::new();
    for mount in &config.folder_mounts {
        normalize_relative_payload_path(&mount.source_relative_path)?;
        let normalized_target = normalize_windows_mount_target(&mount.target_windows_path)?;

        if !seen_mount_targets.insert(normalized_target.to_ascii_lowercase()) {
            return Err(LuthierError::DuplicateFolderMountTarget(
                mount.target_windows_path.clone(),
            ));
        }
    }

    Ok(())
}

pub fn validate_game_config(config: &GameConfig) -> Result<(), LuthierError> {
    let issues = collect_game_config_validation_issues(config);
    if issues.is_empty() {
        Ok(())
    } else {
        Err(LuthierError::invalid_game_config(issues))
    }
}

pub fn collect_game_config_validation_issues(config: &GameConfig) -> Vec<ConfigValidationIssue> {
    let mut issues = Vec::new();

    if let Err(err) = validate_game_config_relative_paths(config) {
        issues.push(issue("relative_paths", "payload.paths", err.to_string()));
    }

    if config.game_name.trim().is_empty() {
        issues.push(issue(
            "game_name_required",
            "game_name",
            "game name is required",
        ));
    }

    if !is_valid_sha256_hex(&config.exe_hash) {
        issues.push(issue(
            "exe_hash_invalid",
            "exe_hash",
            "exe_hash must be a 64-character hexadecimal SHA-256",
        ));
    }

    if config.runner.proton_version.trim().is_empty() {
        issues.push(issue(
            "runner_proton_version_required",
            "runner.proton_version",
            "runner.proton_version is required",
        ));
    }

    for key in config.environment.custom_vars.keys() {
        if let Some(reason) = validate_env_var_name(key) {
            issues.push(issue(
                "env_var_name_invalid",
                &format!("environment.custom_vars.{key}"),
                reason,
            ));
        }
    }

    for (index, wrapper) in config.compatibility.wrapper_commands.iter().enumerate() {
        let field = format!("compatibility.wrapper_commands[{index}]");
        if wrapper.executable.trim().is_empty() {
            issues.push(issue(
                "wrapper_executable_required",
                &field,
                "wrapper executable/command is required",
            ));
            continue;
        }
        if let Some(reason) = validate_wrapper_executable(&wrapper.executable) {
            issues.push(issue("wrapper_executable_invalid", &field, reason));
        }
    }

    let mut seen_registry_pairs = HashSet::new();
    for (index, entry) in config.registry_keys.iter().enumerate() {
        if entry.path.trim().is_empty() {
            issues.push(issue(
                "registry_path_required",
                &format!("registry_keys[{index}].path"),
                "registry path is required",
            ));
        } else if let Some(reason) = validate_registry_path(&entry.path) {
            issues.push(issue(
                "registry_path_invalid",
                &format!("registry_keys[{index}].path"),
                reason,
            ));
        }

        if entry.name.trim().is_empty() {
            issues.push(issue(
                "registry_name_required",
                &format!("registry_keys[{index}].name"),
                "registry value name is required",
            ));
        }

        if let Some(reason) = validate_registry_value_type(&entry.value_type) {
            issues.push(issue(
                "registry_value_type_invalid",
                &format!("registry_keys[{index}].value_type"),
                reason,
            ));
        }

        let pair_key = format!(
            "{}|{}",
            entry.path.trim().to_ascii_lowercase(),
            entry.name.trim().to_ascii_lowercase()
        );
        if !entry.path.trim().is_empty()
            && !entry.name.trim().is_empty()
            && !seen_registry_pairs.insert(pair_key)
        {
            issues.push(issue(
                "registry_duplicate_pair",
                &format!("registry_keys[{index}]"),
                "duplicate registry path/name entry",
            ));
        }
    }

    for (index, dep) in config.extra_system_dependencies.iter().enumerate() {
        if dep.name.trim().is_empty() {
            issues.push(issue(
                "system_dependency_name_required",
                &format!("extra_system_dependencies[{index}].name"),
                "system dependency name is required",
            ));
        }

        for (command_index, command) in dep.check_commands.iter().enumerate() {
            if let Some(reason) = validate_command_token(command) {
                issues.push(issue(
                    "system_dependency_command_invalid",
                    &format!("extra_system_dependencies[{index}].check_commands[{command_index}]"),
                    reason,
                ));
            }
        }

        for (env_index, env_var) in dep.check_env_vars.iter().enumerate() {
            if let Some(reason) = validate_env_var_name(env_var) {
                issues.push(issue(
                    "system_dependency_env_var_invalid",
                    &format!("extra_system_dependencies[{index}].check_env_vars[{env_index}]"),
                    reason,
                ));
            }
        }

        for (path_index, path) in dep.check_paths.iter().enumerate() {
            if let Some(reason) = validate_linux_absolute_path(path) {
                issues.push(issue(
                    "system_dependency_path_invalid",
                    &format!("extra_system_dependencies[{index}].check_paths[{path_index}]"),
                    reason,
                ));
            }
        }
    }

    for (index, item) in config.winecfg.dll_overrides.iter().enumerate() {
        if let Some(reason) = validate_dll_name(&item.dll) {
            issues.push(issue(
                "winecfg_dll_override_invalid",
                &format!("winecfg.dll_overrides[{index}].dll"),
                reason,
            ));
        }
    }

    for (index, item) in config.winecfg.desktop_folders.iter().enumerate() {
        if let Some(reason) = validate_windows_friendly_name(&item.shortcut_name) {
            issues.push(issue(
                "winecfg_desktop_folder_shortcut_invalid",
                &format!("winecfg.desktop_folders[{index}].shortcut_name"),
                reason,
            ));
        }
        if let Some(reason) = validate_linux_absolute_path(&item.linux_path) {
            issues.push(issue(
                "winecfg_desktop_folder_linux_path_invalid",
                &format!("winecfg.desktop_folders[{index}].linux_path"),
                reason,
            ));
        }
    }

    for (index, drive) in config.winecfg.drives.iter().enumerate() {
        if let Some(host_path) = &drive.host_path {
            if let Some(reason) = validate_linux_absolute_path(host_path) {
                issues.push(issue(
                    "winecfg_drive_host_path_invalid",
                    &format!("winecfg.drives[{index}].host_path"),
                    reason,
                ));
            }
        }
        if let Some(label) = &drive.label {
            if let Some(reason) = validate_windows_friendly_name(label) {
                issues.push(issue(
                    "winecfg_drive_label_invalid",
                    &format!("winecfg.drives[{index}].label"),
                    reason,
                ));
            }
        }
        if let Some(serial) = &drive.serial {
            if let Some(reason) = validate_drive_serial(serial) {
                issues.push(issue(
                    "winecfg_drive_serial_invalid",
                    &format!("winecfg.drives[{index}].serial"),
                    reason,
                ));
            }
        }
    }

    if !config.winecfg.virtual_desktop.state.use_wine_default
        && config.winecfg.virtual_desktop.state.is_enabled()
    {
        match config.winecfg.virtual_desktop.resolution.as_deref() {
            Some(value) if !value.trim().is_empty() => {
                if let Some(reason) = validate_resolution_pair(value, 1, 16384) {
                    issues.push(issue(
                        "winecfg_virtual_desktop_resolution_invalid",
                        "winecfg.virtual_desktop.resolution",
                        reason,
                    ));
                }
            }
            _ => {
                issues.push(issue(
                    "winecfg_virtual_desktop_resolution_required",
                    "winecfg.virtual_desktop.resolution",
                    "virtual desktop resolution is required when the override is enabled",
                ));
            }
        }
    }

    if config.environment.gamescope.state.is_enabled() {
        validate_required_bounded_number(
            &mut issues,
            "environment.gamescope.game_width",
            "gamescope_game_width",
            &config.environment.gamescope.game_width,
            1,
            16384,
        );
        validate_required_bounded_number(
            &mut issues,
            "environment.gamescope.game_height",
            "gamescope_game_height",
            &config.environment.gamescope.game_height,
            1,
            16384,
        );

        let uses_auto_output = config.environment.gamescope.output_width.trim().is_empty()
            && config.environment.gamescope.output_height.trim().is_empty();
        if !uses_auto_output {
            validate_required_bounded_number(
                &mut issues,
                "environment.gamescope.output_width",
                "gamescope_output_width",
                &config.environment.gamescope.output_width,
                1,
                16384,
            );
            validate_required_bounded_number(
                &mut issues,
                "environment.gamescope.output_height",
                "gamescope_output_height",
                &config.environment.gamescope.output_height,
                1,
                16384,
            );
        }

        if config.environment.gamescope.enable_limiter {
            validate_required_bounded_number(
                &mut issues,
                "environment.gamescope.fps_limiter",
                "gamescope_fps_limiter",
                &config.environment.gamescope.fps_limiter,
                1,
                1000,
            );
            validate_required_bounded_number(
                &mut issues,
                "environment.gamescope.fps_limiter_no_focus",
                "gamescope_fps_limiter_no_focus",
                &config.environment.gamescope.fps_limiter_no_focus,
                1,
                1000,
            );
        }
    }

    issues
}

fn normalize_relative_payload_path(raw: &str) -> Result<String, LuthierError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(LuthierError::InvalidRelativePath(raw.to_string()));
    }

    let normalized = trimmed.replace('\\', "/");
    if normalized.starts_with('/') || has_windows_drive_prefix(&normalized) {
        return Err(LuthierError::AbsolutePathNotAllowed(raw.to_string()));
    }

    let mut out = Vec::new();
    for part in normalized.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }

        if part == ".." {
            return Err(LuthierError::PathTraversalNotAllowed(raw.to_string()));
        }

        out.push(part);
    }

    if out.is_empty() {
        return Err(LuthierError::InvalidRelativePath(raw.to_string()));
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

fn normalize_windows_mount_target(raw: &str) -> Result<String, LuthierError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(LuthierError::InvalidFolderMountTarget(raw.to_string()));
    }

    if trimmed.contains('%') {
        return Err(LuthierError::InvalidFolderMountTarget(raw.to_string()));
    }

    if trimmed.starts_with("\\\\") || trimmed.starts_with("//") {
        return Err(LuthierError::InvalidFolderMountTarget(raw.to_string()));
    }

    let normalized = trimmed.replace('/', "\\");
    let bytes = normalized.as_bytes();
    if bytes.len() < 2 || bytes[1] != b':' || !bytes[0].is_ascii_alphabetic() {
        return Err(LuthierError::InvalidFolderMountTarget(raw.to_string()));
    }

    let drive = (bytes[0] as char).to_ascii_uppercase();
    let remainder = normalized[2..].trim_start_matches('\\');
    if remainder.is_empty() {
        return Err(LuthierError::InvalidFolderMountTarget(raw.to_string()));
    }

    let mut segments = Vec::new();
    for segment in remainder.split('\\') {
        if segment.is_empty() || segment == "." {
            continue;
        }

        if segment == ".." {
            return Err(LuthierError::InvalidFolderMountTarget(raw.to_string()));
        }

        segments.push(segment);
    }

    if segments.is_empty() {
        return Err(LuthierError::InvalidFolderMountTarget(raw.to_string()));
    }

    Ok(format!(r"{drive}:\{}", segments.join("\\")))
}

fn issue(code: &str, field: &str, message: impl Into<String>) -> ConfigValidationIssue {
    ConfigValidationIssue {
        code: code.to_string(),
        field: field.to_string(),
        message: message.into(),
    }
}

fn validate_required_bounded_number(
    issues: &mut Vec<ConfigValidationIssue>,
    field: &str,
    code_prefix: &str,
    raw: &str,
    min: u32,
    max: u32,
) {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        issues.push(issue(
            &format!("{code_prefix}_required"),
            field,
            format!("{field} is required"),
        ));
        return;
    }

    if let Some(reason) = validate_positive_bounded_integer(raw, min, max) {
        issues.push(issue(&format!("{code_prefix}_invalid"), field, reason));
    }
}

fn validate_positive_bounded_integer(raw: &str, min: u32, max: u32) -> Option<String> {
    let trimmed = raw.trim();
    if !trimmed.chars().all(|ch| ch.is_ascii_digit()) {
        return Some("must contain only positive digits".to_string());
    }
    let Ok(value) = trimmed.parse::<u32>() else {
        return Some("invalid positive number".to_string());
    };
    if value < min || value > max {
        return Some(format!("must be between {min} and {max}"));
    }
    None
}

fn validate_resolution_pair(raw: &str, min: u32, max: u32) -> Option<String> {
    let trimmed = raw.trim();
    let Some((left, right)) = trimmed.split_once('x') else {
        return Some("resolution must use the format WIDTHxHEIGHT".to_string());
    };
    if let Some(reason) = validate_positive_bounded_integer(left, min, max) {
        return Some(format!("invalid width: {reason}"));
    }
    if let Some(reason) = validate_positive_bounded_integer(right, min, max) {
        return Some(format!("invalid height: {reason}"));
    }
    None
}

fn is_valid_sha256_hex(raw: &str) -> bool {
    let trimmed = raw.trim();
    trimmed.len() == 64 && trimmed.chars().all(|ch| ch.is_ascii_hexdigit())
}

fn has_control_chars(raw: &str) -> bool {
    raw.chars().any(|ch| ch.is_control())
}

fn validate_env_var_name(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Some("environment variable name is empty".to_string());
    }
    let mut chars = trimmed.chars();
    let first = chars.next()?;
    if !(first == '_' || first.is_ascii_alphabetic()) {
        return Some("must start with a letter or underscore".to_string());
    }
    if !chars.all(|ch| ch == '_' || ch.is_ascii_alphanumeric()) {
        return Some("must contain only letters, digits, or underscore".to_string());
    }
    None
}

fn validate_wrapper_executable(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Some("wrapper executable is empty".to_string());
    }
    if trimmed.contains(' ') || trimmed.contains('\t') {
        return Some(
            "wrapper executable must not contain spaces; move arguments to the args field"
                .to_string(),
        );
    }
    if trimmed.starts_with('"') || trimmed.starts_with('\'') {
        return Some("wrapper executable must not be quoted".to_string());
    }
    if has_control_chars(trimmed) {
        return Some("wrapper executable contains invalid control characters".to_string());
    }
    if trimmed.starts_with('/') {
        return None;
    }
    if trimmed.contains('\\') || has_windows_drive_prefix(trimmed) {
        return Some(
            "wrapper executable looks like a Windows path; use a Linux command/path".to_string(),
        );
    }
    None
}

fn validate_command_token(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Some("command token is empty".to_string());
    }
    if has_control_chars(trimmed) {
        return Some("command token contains invalid control characters".to_string());
    }
    if trimmed.contains(' ') || trimmed.contains('\t') {
        return Some("command token must not contain spaces".to_string());
    }
    if has_windows_drive_prefix(trimmed) || trimmed.contains('\\') {
        return Some(
            "command token looks like a Windows path; use a Linux command/path".to_string(),
        );
    }
    None
}

fn validate_linux_absolute_path(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Some("Linux path is empty".to_string());
    }
    if has_control_chars(trimmed) {
        return Some("Linux path contains invalid control characters".to_string());
    }
    if has_windows_drive_prefix(trimmed) || trimmed.starts_with("\\\\") {
        return Some("expected a Linux path, but received a Windows-style path".to_string());
    }
    if !trimmed.starts_with('/') {
        return Some("Linux path must be absolute and start with '/'".to_string());
    }
    None
}

fn validate_registry_path(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Some("registry path is empty".to_string());
    }
    if has_control_chars(trimmed) {
        return Some("registry path contains invalid control characters".to_string());
    }

    let upper = trimmed.replace('/', "\\").to_ascii_uppercase();
    let valid_hive = [
        "HKCU\\",
        "HKLM\\",
        "HKCR\\",
        "HKU\\",
        "HKCC\\",
        "HKEY_CURRENT_USER\\",
        "HKEY_LOCAL_MACHINE\\",
        "HKEY_CLASSES_ROOT\\",
        "HKEY_USERS\\",
        "HKEY_CURRENT_CONFIG\\",
    ]
    .iter()
    .any(|prefix| upper.starts_with(prefix));

    if !valid_hive {
        return Some("registry path must start with a supported Windows registry hive".to_string());
    }
    None
}

fn validate_registry_value_type(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Some("registry value type is empty".to_string());
    }
    let upper = trimmed.to_ascii_uppercase();
    const ALLOWED: [&str; 5] = [
        "REG_SZ",
        "REG_DWORD",
        "REG_QWORD",
        "REG_BINARY",
        "REG_MULTI_SZ",
    ];
    if ALLOWED.contains(&upper.as_str()) {
        None
    } else {
        Some("unsupported registry value type".to_string())
    }
}

fn validate_dll_name(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Some("DLL name is empty".to_string());
    }
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains(':') {
        return Some("DLL override expects a DLL name, not a path".to_string());
    }
    if trimmed
        .chars()
        .any(|ch| ch.is_control() || matches!(ch, '<' | '>' | '"' | '|' | '?' | '*'))
    {
        return Some("DLL name contains invalid characters".to_string());
    }
    None
}

fn validate_windows_friendly_name(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Some("value is empty".to_string());
    }
    if trimmed.chars().any(|ch| {
        ch.is_control() || matches!(ch, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*')
    }) {
        return Some("contains characters not allowed in Windows names".to_string());
    }
    if trimmed.ends_with(' ') || trimmed.ends_with('.') {
        return Some("must not end with a space or dot on Windows".to_string());
    }
    None
}

fn validate_drive_serial(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.len() > 32 {
        return Some("drive serial is too long".to_string());
    }
    if !trimmed
        .chars()
        .all(|ch| ch.is_ascii_hexdigit() || ch == '-')
    {
        return Some("drive serial must contain only hexadecimal characters and '-'".to_string());
    }
    None
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
