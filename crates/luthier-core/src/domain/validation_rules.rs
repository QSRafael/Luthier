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

pub(crate) fn collect_game_config_validation_issues(
    config: &GameConfig,
) -> Vec<ConfigValidationIssue> {
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
    if !trimmed
        .chars()
        .all(|ch| ch.is_ascii_hexdigit() || ch == '-')
    {
        return Some("drive serial must contain only hexadecimal characters and '-'".to_string());
    }
    None
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use luthier_orchestrator_core::config::{
        CompatibilityConfig, DllOverrideRule, EnvConfig, FeatureState, FolderMount, GameConfig,
        GamescopeConfig, RegistryKey, RequirementsConfig, RunnerConfig, RuntimeCandidate,
        RuntimePolicy, RuntimePreference, ScriptsConfig, SplashConfig, SystemDependency,
        VirtualDesktopConfig, WineDesktopFolderMapping, WineDriveMapping, WinecfgConfig,
        WinecfgFeaturePolicy, WrapperCommand,
    };

    use super::{collect_game_config_validation_issues, validate_game_config_relative_paths};
    use crate::{ConfigValidationIssue, LuthierError};

    #[test]
    fn reports_env_var_and_wrapper_issues_with_expected_code_and_field_paths() {
        let mut cfg = sample_config();
        cfg.environment
            .custom_vars
            .insert("1INVALID".to_string(), "x".to_string());
        cfg.compatibility.wrapper_commands = vec![
            WrapperCommand {
                state: FeatureState::OptionalOn,
                executable: r"C:\tools\wrapper.exe".to_string(),
                args: String::new(),
            },
            WrapperCommand {
                state: FeatureState::OptionalOn,
                executable: "   ".to_string(),
                args: String::new(),
            },
        ];

        let issues = collect_game_config_validation_issues(&cfg);

        let env_issue = find_issue(
            &issues,
            "env_var_name_invalid",
            "environment.custom_vars.1INVALID",
        )
        .expect("invalid env var key must produce a field-scoped issue");
        assert_eq!(env_issue.message, "must start with a letter or underscore");

        let wrapper_invalid = find_issue(
            &issues,
            "wrapper_executable_invalid",
            "compatibility.wrapper_commands[0]",
        )
        .expect("windows wrapper path must be rejected");
        assert!(wrapper_invalid.message.contains("Windows path"));

        let wrapper_required = find_issue(
            &issues,
            "wrapper_executable_required",
            "compatibility.wrapper_commands[1]",
        )
        .expect("empty wrapper executable must be required");
        assert_eq!(
            wrapper_required.message,
            "wrapper executable/command is required"
        );
    }

    #[test]
    fn reports_winecfg_desktop_and_drive_issues_with_precise_paths() {
        let mut cfg = sample_config();
        cfg.winecfg.desktop_folders = vec![WineDesktopFolderMapping {
            folder_key: "desktop".to_string(),
            shortcut_name: "Bad:Name".to_string(),
            linux_path: "home/user/Desktop".to_string(),
        }];
        cfg.winecfg.drives = vec![WineDriveMapping {
            letter: "D".to_string(),
            source_relative_path: "drive_d".to_string(),
            state: FeatureState::OptionalOn,
            host_path: Some(r"C:\games\host".to_string()),
            drive_type: None,
            label: Some("Drive.".to_string()),
            serial: Some("12-XY".to_string()),
        }];

        let issues = collect_game_config_validation_issues(&cfg);

        assert!(find_issue(
            &issues,
            "winecfg_desktop_folder_shortcut_invalid",
            "winecfg.desktop_folders[0].shortcut_name"
        )
        .is_some());
        assert!(find_issue(
            &issues,
            "winecfg_desktop_folder_linux_path_invalid",
            "winecfg.desktop_folders[0].linux_path"
        )
        .is_some());
        assert!(find_issue(
            &issues,
            "winecfg_drive_host_path_invalid",
            "winecfg.drives[0].host_path"
        )
        .is_some());
        assert!(find_issue(
            &issues,
            "winecfg_drive_label_invalid",
            "winecfg.drives[0].label"
        )
        .is_some());
        assert!(find_issue(
            &issues,
            "winecfg_drive_serial_invalid",
            "winecfg.drives[0].serial"
        )
        .is_some());
    }

    #[test]
    fn reports_virtual_desktop_resolution_required_and_invalid_format() {
        let mut cfg_missing_resolution = sample_config();
        cfg_missing_resolution.winecfg.virtual_desktop.state = WinecfgFeaturePolicy {
            state: FeatureState::OptionalOn,
            use_wine_default: false,
        };
        cfg_missing_resolution.winecfg.virtual_desktop.resolution = None;

        let missing = collect_game_config_validation_issues(&cfg_missing_resolution);
        assert!(find_issue(
            &missing,
            "winecfg_virtual_desktop_resolution_required",
            "winecfg.virtual_desktop.resolution"
        )
        .is_some());

        let mut cfg_bad_format = sample_config();
        cfg_bad_format.winecfg.virtual_desktop.state = WinecfgFeaturePolicy {
            state: FeatureState::OptionalOn,
            use_wine_default: false,
        };
        cfg_bad_format.winecfg.virtual_desktop.resolution = Some("1920-1080".to_string());

        let invalid = collect_game_config_validation_issues(&cfg_bad_format);
        let issue = find_issue(
            &invalid,
            "winecfg_virtual_desktop_resolution_invalid",
            "winecfg.virtual_desktop.resolution",
        )
        .expect("invalid virtual desktop resolution format must be reported");
        assert!(issue
            .message
            .contains("resolution must use the format WIDTHxHEIGHT"));
    }

    #[test]
    fn reports_gamescope_dimension_and_limiter_issues_with_expected_codes() {
        let mut cfg = sample_config();
        cfg.environment.gamescope.state = FeatureState::OptionalOn;
        cfg.environment.gamescope.game_width.clear();
        cfg.environment.gamescope.game_height = "17000".to_string();
        cfg.environment.gamescope.output_width = "1920".to_string();
        cfg.environment.gamescope.output_height.clear();
        cfg.environment.gamescope.enable_limiter = true;
        cfg.environment.gamescope.fps_limiter = "0".to_string();
        cfg.environment.gamescope.fps_limiter_no_focus = "abc".to_string();

        let issues = collect_game_config_validation_issues(&cfg);

        assert!(find_issue(
            &issues,
            "gamescope_game_width_required",
            "environment.gamescope.game_width"
        )
        .is_some());
        assert!(find_issue(
            &issues,
            "gamescope_game_height_invalid",
            "environment.gamescope.game_height"
        )
        .is_some());
        assert!(find_issue(
            &issues,
            "gamescope_output_height_required",
            "environment.gamescope.output_height"
        )
        .is_some());
        assert!(find_issue(
            &issues,
            "gamescope_fps_limiter_invalid",
            "environment.gamescope.fps_limiter"
        )
        .is_some());
        assert!(find_issue(
            &issues,
            "gamescope_fps_limiter_no_focus_invalid",
            "environment.gamescope.fps_limiter_no_focus"
        )
        .is_some());
    }

    #[test]
    fn keeps_gamescope_output_dimensions_optional_when_auto_output_is_used() {
        let mut cfg = sample_config();
        cfg.environment.gamescope.state = FeatureState::OptionalOn;
        cfg.environment.gamescope.game_width = "1280".to_string();
        cfg.environment.gamescope.game_height = "720".to_string();
        cfg.environment.gamescope.output_width.clear();
        cfg.environment.gamescope.output_height.clear();

        let issues = collect_game_config_validation_issues(&cfg);
        assert!(find_issue(
            &issues,
            "gamescope_output_width_required",
            "environment.gamescope.output_width",
        )
        .is_none());
        assert!(find_issue(
            &issues,
            "gamescope_output_height_required",
            "environment.gamescope.output_height",
        )
        .is_none());
    }

    #[test]
    fn reports_sensitive_deduplications_for_registry_and_folder_mount_targets() {
        let mut cfg = sample_config();
        cfg.registry_keys = vec![
            RegistryKey {
                path: r"HKCU\Software\MyGame".to_string(),
                name: "InstallDir".to_string(),
                value_type: "REG_SZ".to_string(),
                value: "/games/my-game".to_string(),
            },
            RegistryKey {
                path: r"hkcu\software\mygame".to_string(),
                name: "installdir".to_string(),
                value_type: "REG_SZ".to_string(),
                value: "/games/other".to_string(),
            },
        ];
        cfg.folder_mounts = vec![
            FolderMount {
                source_relative_path: "save_a".to_string(),
                target_windows_path: r"C:\Users\steamuser\Documents\MyGame".to_string(),
                create_source_if_missing: true,
            },
            FolderMount {
                source_relative_path: "save_b".to_string(),
                target_windows_path: r"c:/users/steamuser/documents/mygame".to_string(),
                create_source_if_missing: true,
            },
        ];

        let err = validate_game_config_relative_paths(&cfg)
            .expect_err("duplicate mount targets must be rejected case-insensitively");
        assert!(matches!(
            &err,
            LuthierError::DuplicateFolderMountTarget(value)
                if value == r"c:/users/steamuser/documents/mygame"
        ));

        let issues = collect_game_config_validation_issues(&cfg);
        let relative_paths = find_issue(&issues, "relative_paths", "payload.paths")
            .expect("path-level failure must be mapped to payload.paths");
        assert!(relative_paths
            .message
            .contains("duplicate folder mount target windows path"));

        let registry_duplicate = find_issue(&issues, "registry_duplicate_pair", "registry_keys[1]")
            .expect("duplicate registry path/name pair must be reported");
        assert_eq!(
            registry_duplicate.message,
            "duplicate registry path/name entry"
        );
    }

    #[test]
    fn accepts_known_winecfg_audio_driver_without_issue() {
        let mut cfg = sample_config();
        cfg.winecfg.audio_driver = Some("pipewire".to_string());

        let issues = collect_game_config_validation_issues(&cfg);
        assert!(issues
            .iter()
            .all(|issue| issue.field.as_str() != "winecfg.audio_driver"));
    }

    fn find_issue<'a>(
        issues: &'a [ConfigValidationIssue],
        code: &str,
        field: &str,
    ) -> Option<&'a ConfigValidationIssue> {
        issues
            .iter()
            .find(|issue| issue.code == code && issue.field == field)
    }

    fn sample_config() -> GameConfig {
        GameConfig {
            config_version: 1,
            created_by: "test".to_string(),
            game_name: "Sample".to_string(),
            exe_hash: "a".repeat(64),
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
                dll_overrides: vec![DllOverrideRule {
                    dll: "d3d11.dll".to_string(),
                    mode: "native,builtin".to_string(),
                }],
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
            extra_system_dependencies: vec![SystemDependency {
                name: "gamescope".to_string(),
                state: FeatureState::OptionalOff,
                check_commands: vec!["gamescope".to_string()],
                check_env_vars: vec![],
                check_paths: vec!["/usr/bin/gamescope".to_string()],
            }],
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
}
