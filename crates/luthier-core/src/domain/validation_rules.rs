use std::collections::HashSet;

use luthier_orchestrator_core::GameConfig;

use crate::{ConfigValidationIssue, LuthierError};

use super::path_rules::{
    has_windows_drive_prefix, normalize_relative_payload_path, normalize_windows_mount_target,
};

pub(crate) fn validate_game_config_relative_paths(config: &GameConfig) -> Result<(), LuthierError> {
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

pub(crate) fn validate_game_config(config: &GameConfig) -> Result<(), LuthierError> {
    let issues = collect_game_config_validation_issues(config);
    if issues.is_empty() {
        Ok(())
    } else {
        Err(LuthierError::invalid_game_config(issues))
    }
}

pub(crate) fn collect_game_config_validation_issues(config: &GameConfig) -> Vec<ConfigValidationIssue> {
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
    if !trimmed.chars().all(|ch| ch.is_ascii_hexdigit() || ch == '-') {
        return Some("drive serial must contain only hexadecimal characters and '-'".to_string());
    }
    None
}
