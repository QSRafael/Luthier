use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use creator_core::{create_orchestrator_binary, sha256_file, CreateOrchestratorRequest};
use orchestrator_core::{
    doctor::run_doctor, prefix::build_prefix_setup_plan, GameConfig, RegistryKey,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateExecutableInput {
    pub base_binary_path: String,
    pub output_path: String,
    pub config_json: String,
    pub backup_existing: bool,
    pub make_executable: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateExecutableOutput {
    pub output_path: String,
    pub config_size_bytes: usize,
    pub config_sha256_hex: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HashExeInput {
    pub executable_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HashExeOutput {
    pub sha256_hex: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestConfigurationInput {
    pub config_json: String,
    pub game_root: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestConfigurationOutput {
    pub status: String,
    pub missing_files: Vec<String>,
    pub doctor: serde_json::Value,
    pub prefix_setup_plan: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WinetricksAvailableOutput {
    pub source: String,
    pub components: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportRegistryFileInput {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportRegistryFileOutput {
    pub entries: Vec<RegistryKey>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ListChildDirectoriesInput {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ListChildDirectoriesOutput {
    pub path: String,
    pub directories: Vec<String>,
}

pub fn create_executable(input: CreateExecutableInput) -> Result<CreateExecutableOutput, String> {
    let config: GameConfig = serde_json::from_str(&input.config_json)
        .map_err(|err| format!("invalid config JSON: {err}"))?;

    let request = CreateOrchestratorRequest {
        base_binary_path: PathBuf::from(input.base_binary_path),
        output_path: PathBuf::from(input.output_path),
        config,
        backup_existing: input.backup_existing,
        make_executable: input.make_executable,
    };

    let result = create_orchestrator_binary(&request).map_err(|err| err.to_string())?;

    Ok(CreateExecutableOutput {
        output_path: result.output_path,
        config_size_bytes: result.config_size_bytes,
        config_sha256_hex: result.config_sha256_hex,
    })
}

pub fn hash_executable(input: HashExeInput) -> Result<HashExeOutput, String> {
    let path = PathBuf::from(input.executable_path);
    let hash = sha256_file(&path).map_err(|err| err.to_string())?;

    Ok(HashExeOutput { sha256_hex: hash })
}

pub fn test_configuration(
    input: TestConfigurationInput,
) -> Result<TestConfigurationOutput, String> {
    let config: GameConfig = serde_json::from_str(&input.config_json)
        .map_err(|err| format!("invalid config JSON: {err}"))?;

    creator_core::validate_game_config_relative_paths(&config).map_err(|err| err.to_string())?;

    let game_root = PathBuf::from(&input.game_root);
    let missing_files = collect_missing_files(&config, &game_root)?;
    let doctor = run_doctor(Some(&config));
    let prefix_plan = build_prefix_setup_plan(&config).map_err(|err| err.to_string())?;

    let has_blocker = matches!(
        doctor.summary,
        orchestrator_core::doctor::CheckStatus::BLOCKER
    );
    let status = if has_blocker || !missing_files.is_empty() {
        "BLOCKER"
    } else {
        "OK"
    };

    Ok(TestConfigurationOutput {
        status: status.to_string(),
        missing_files,
        doctor: serde_json::to_value(doctor).map_err(|err| err.to_string())?,
        prefix_setup_plan: serde_json::to_value(prefix_plan).map_err(|err| err.to_string())?,
    })
}

pub fn winetricks_available() -> Result<WinetricksAvailableOutput, String> {
    let fallback = fallback_winetricks_components();
    let Some(binary) = find_executable_in_path("winetricks") else {
        return Ok(WinetricksAvailableOutput {
            source: "fallback".to_string(),
            components: fallback,
        });
    };

    let mut components = BTreeSet::new();
    for args in &[["dlls", "list"], ["fonts", "list"]] {
        let output = Command::new(&binary)
            .args(args)
            .output()
            .map_err(|err| format!("failed to execute winetricks: {err}"))?;

        if !output.status.success() {
            continue;
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        for component in parse_winetricks_components(&stdout) {
            components.insert(component);
        }
    }

    let parsed = components.into_iter().collect::<Vec<String>>();
    if parsed.is_empty() {
        return Ok(WinetricksAvailableOutput {
            source: "fallback".to_string(),
            components: fallback,
        });
    }

    Ok(WinetricksAvailableOutput {
        source: "winetricks".to_string(),
        components: parsed,
    })
}

pub fn import_registry_file(
    input: ImportRegistryFileInput,
) -> Result<ImportRegistryFileOutput, String> {
    let bytes = fs::read(&input.path).map_err(|err| format!("failed to read .reg file: {err}"))?;
    let raw = decode_reg_file_text(&bytes)?;
    let (entries, warnings) = parse_reg_file_entries(&raw);

    if entries.is_empty() {
        return Err("no importable registry entries found in .reg file".to_string());
    }

    Ok(ImportRegistryFileOutput { entries, warnings })
}

pub fn list_child_directories(
    input: ListChildDirectoriesInput,
) -> Result<ListChildDirectoriesOutput, String> {
    let root = PathBuf::from(&input.path);
    let entries = fs::read_dir(&root).map_err(|err| format!("failed to list directory: {err}"))?;

    let mut directories = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|err| format!("failed to read directory entry: {err}"))?;
        let path = entry.path();
        if path.is_dir() {
            directories.push(path.to_string_lossy().into_owned());
        }
    }

    directories.sort_by_key(|value| value.to_ascii_lowercase());

    Ok(ListChildDirectoriesOutput {
        path: input.path,
        directories,
    })
}

fn collect_missing_files(config: &GameConfig, game_root: &Path) -> Result<Vec<String>, String> {
    let mut missing = Vec::new();

    let exe_path = resolve_relative_path(game_root, &config.relative_exe_path)?;
    if !exe_path.exists() {
        missing.push(config.relative_exe_path.clone());
    }

    for file in &config.integrity_files {
        let path = resolve_relative_path(game_root, file)?;
        if !path.exists() {
            missing.push(file.clone());
        }
    }

    Ok(missing)
}

fn resolve_relative_path(base: &Path, relative: &str) -> Result<PathBuf, String> {
    let normalized = normalize_relative_payload_path(relative)?;
    Ok(base.join(normalized))
}

fn normalize_relative_payload_path(raw: &str) -> Result<PathBuf, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("path is empty".to_string());
    }

    let normalized = trimmed.replace('\\', "/");
    if normalized.starts_with('/') || has_windows_drive_prefix(&normalized) {
        return Err(format!("absolute path is not allowed: {raw}"));
    }

    let mut out = PathBuf::new();
    for part in normalized.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }

        if part == ".." {
            return Err(format!("path traversal is not allowed: {raw}"));
        }

        out.push(part);
    }

    if out.as_os_str().is_empty() {
        return Err(format!("path resolves to empty value: {raw}"));
    }

    Ok(out)
}

fn has_windows_drive_prefix(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic()
}

fn parse_winetricks_components(raw: &str) -> Vec<String> {
    raw.lines()
        .filter_map(|line| {
            let entry = line.split_whitespace().next()?;
            if entry.starts_with('#') || entry.contains(':') {
                return None;
            }

            if entry
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.'))
            {
                Some(entry.to_string())
            } else {
                None
            }
        })
        .collect()
}

fn find_executable_in_path(name: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    for directory in std::env::split_paths(&path_var) {
        let candidate = directory.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn fallback_winetricks_components() -> Vec<String> {
    [
        "corefonts",
        "d3dx9",
        "d3dcompiler_47",
        "dotnet48",
        "dxvk",
        "faudio",
        "galliumnine",
        "mf",
        "msxml3",
        "physx",
        "vcrun2005",
        "vcrun2008",
        "vcrun2010",
        "vcrun2013",
        "vcrun2019",
        "xact",
        "xinput",
    ]
    .iter()
    .map(|item| item.to_string())
    .collect()
}

fn decode_reg_file_text(bytes: &[u8]) -> Result<String, String> {
    if bytes.starts_with(&[0xFF, 0xFE]) {
        let mut units = Vec::new();
        let mut iter = bytes[2..].chunks_exact(2);
        for chunk in &mut iter {
            units.push(u16::from_le_bytes([chunk[0], chunk[1]]));
        }
        return String::from_utf16(&units)
            .map_err(|err| format!("invalid UTF-16LE .reg file: {err}"));
    }

    if bytes.starts_with(&[0xFE, 0xFF]) {
        return Err("UTF-16BE .reg files are not supported".to_string());
    }

    let text = String::from_utf8(bytes.to_vec())
        .map_err(|err| format!("invalid UTF-8 .reg file: {err}"))?;
    Ok(text.strip_prefix('\u{feff}').unwrap_or(&text).to_string())
}

fn parse_reg_file_entries(raw: &str) -> (Vec<RegistryKey>, Vec<String>) {
    let mut entries = Vec::new();
    let mut warnings = Vec::new();
    let mut current_path: Option<String> = None;

    for line in fold_reg_continuations(raw).lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with(';') || trimmed.starts_with('#') {
            continue;
        }

        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            current_path = Some(trimmed[1..trimmed.len() - 1].trim().to_string());
            continue;
        }

        if trimmed.eq_ignore_ascii_case("windows registry editor version 5.00")
            || trimmed.eq_ignore_ascii_case("regedit4")
        {
            continue;
        }

        let Some(path) = current_path.clone() else {
            warnings.push(format!(
                "ignored line outside registry key section: {trimmed}"
            ));
            continue;
        };

        let Some((name_raw, value_raw)) = trimmed.split_once('=') else {
            warnings.push(format!("ignored unparsable registry line: {trimmed}"));
            continue;
        };

        let name = match parse_reg_value_name(name_raw.trim()) {
            Some(name) => name,
            None => {
                warnings.push(format!(
                    "ignored registry value with unsupported name syntax: {trimmed}"
                ));
                continue;
            }
        };

        let value_token = value_raw.trim();
        if value_token == "-" {
            warnings.push(format!(
                "ignored deletion entry (unsupported in key list model): {}={}",
                name_raw.trim(),
                value_token
            ));
            continue;
        }

        let (value_type, value, value_warnings) = parse_reg_data(value_token);
        for warning in value_warnings {
            warnings.push(format!("{path} | {name}: {warning}"));
        }
        entries.push(RegistryKey {
            path,
            name,
            value_type,
            value,
        });
    }

    (entries, warnings)
}

fn fold_reg_continuations(raw: &str) -> String {
    let normalized = raw.replace("\r\n", "\n").replace('\r', "\n");
    let mut out = Vec::new();
    let mut acc = String::new();

    for line in normalized.lines() {
        let trimmed_end = line.trim_end();
        if acc.is_empty() {
            acc.push_str(trimmed_end);
        } else {
            acc.push_str(trimmed_end.trim_start());
        }

        if acc.ends_with('\\') {
            acc.pop();
            continue;
        }

        out.push(std::mem::take(&mut acc));
    }

    if !acc.is_empty() {
        out.push(acc);
    }

    out.join("\n")
}

fn parse_reg_value_name(raw: &str) -> Option<String> {
    if raw == "@" {
        return Some("@".to_string());
    }
    if raw.starts_with('"') && raw.ends_with('"') && raw.len() >= 2 {
        return Some(unescape_reg_string(&raw[1..raw.len() - 1]));
    }
    None
}

fn parse_reg_data(raw: &str) -> (String, String, Vec<String>) {
    let lower = raw.to_ascii_lowercase();
    let mut warnings = Vec::new();

    if raw.starts_with('"') && raw.ends_with('"') && raw.len() >= 2 {
        return (
            "REG_SZ".to_string(),
            unescape_reg_string(&raw[1..raw.len() - 1]),
            warnings,
        );
    }

    if let Some(value) = strip_prefix_ascii_case(raw, "dword:") {
        return (
            "REG_DWORD".to_string(),
            value.trim().to_ascii_lowercase(),
            warnings,
        );
    }

    if lower.starts_with("hex(b):") {
        let payload = &raw[7..];
        let value = match normalize_registry_hex_payload(payload) {
            Ok(value) => value,
            Err(err) => {
                warnings.push(format!("kept raw REG_QWORD hex payload ({err})"));
                payload.trim().to_string()
            }
        };
        return ("REG_QWORD".to_string(), value, warnings);
    }

    if lower.starts_with("hex(2):") {
        let payload = &raw[7..];
        let value = match normalize_registry_hex_payload(payload) {
            Ok(value) => value,
            Err(err) => {
                warnings.push(format!("kept raw REG_EXPAND_SZ hex payload ({err})"));
                payload.trim().to_string()
            }
        };
        return ("REG_EXPAND_SZ".to_string(), value, warnings);
    }

    if lower.starts_with("hex(7):") {
        let payload = &raw[7..];
        let value = match normalize_registry_hex_payload(payload) {
            Ok(value) => value,
            Err(err) => {
                warnings.push(format!("kept raw REG_MULTI_SZ hex payload ({err})"));
                payload.trim().to_string()
            }
        };
        return ("REG_MULTI_SZ".to_string(), value, warnings);
    }

    if lower.starts_with("hex:") {
        let original = &raw[4..];
        let value = match normalize_registry_hex_payload(original) {
            Ok(value) => value,
            Err(err) => {
                warnings.push(format!("kept raw REG_BINARY hex payload ({err})"));
                original.trim().to_string()
            }
        };
        return ("REG_BINARY".to_string(), value, warnings);
    }

    if lower.starts_with("hex(") {
        let type_end = raw.find("):").unwrap_or(raw.len());
        let suffix = if type_end + 2 <= raw.len() {
            &raw[type_end + 2..]
        } else {
            ""
        };
        let value = match normalize_registry_hex_payload(suffix) {
            Ok(value) => value,
            Err(err) => {
                warnings.push(format!("kept raw typed hex payload ({err})"));
                suffix.trim().to_string()
            }
        };
        return ("REG_BINARY".to_string(), value, warnings);
    }

    ("REG_SZ".to_string(), raw.trim().to_string(), warnings)
}

fn strip_prefix_ascii_case<'a>(raw: &'a str, prefix: &str) -> Option<&'a str> {
    if raw.len() < prefix.len() {
        return None;
    }
    let (head, tail) = raw.split_at(prefix.len());
    if head.eq_ignore_ascii_case(prefix) {
        Some(tail)
    } else {
        None
    }
}

fn normalize_registry_hex_payload(raw: &str) -> Result<String, String> {
    let mut chunks = Vec::new();
    for token in raw.split(',') {
        let cleaned = token
            .chars()
            .filter(|ch| !ch.is_whitespace())
            .collect::<String>();

        if cleaned.is_empty() {
            continue;
        }

        if cleaned.len() != 2 || !cleaned.chars().all(|ch| ch.is_ascii_hexdigit()) {
            return Err(format!("invalid hex byte token '{cleaned}'"));
        }

        chunks.push(cleaned.to_ascii_lowercase());
    }

    Ok(chunks.join(","))
}

fn unescape_reg_string(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut chars = raw.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            if let Some(next) = chars.next() {
                out.push(match next {
                    '\\' => '\\',
                    '"' => '"',
                    'n' => '\n',
                    'r' => '\r',
                    't' => '\t',
                    other => other,
                });
            } else {
                out.push('\\');
            }
        } else {
            out.push(ch);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid_json_input() {
        let input = CreateExecutableInput {
            base_binary_path: "/tmp/base.bin".to_string(),
            output_path: "/tmp/output.bin".to_string(),
            config_json: "{ invalid json }".to_string(),
            backup_existing: true,
            make_executable: true,
        };

        let err = create_executable(input).expect_err("invalid json must fail");
        assert!(err.contains("invalid config JSON"));
    }

    #[test]
    fn command_wrapper_calls_hash() {
        let input = HashExeInput {
            executable_path: "/does/not/exist.exe".to_string(),
        };
        let err = hash_executable(input).expect_err("missing file must fail");
        assert!(err.contains("io error"));
    }

    #[test]
    fn rejects_invalid_test_config_json() {
        let input = TestConfigurationInput {
            config_json: "{ invalid json }".to_string(),
            game_root: "/tmp".to_string(),
        };

        let err = test_configuration(input).expect_err("invalid json must fail");
        assert!(err.contains("invalid config JSON"));
    }

    #[test]
    fn parses_winetricks_output_lines() {
        let parsed = parse_winetricks_components(
            r#"
            d3dx9                Direct3D 9
            corefonts            Core fonts
            # comment
            "#,
        );

        assert_eq!(parsed, vec!["d3dx9".to_string(), "corefonts".to_string()]);
    }

    #[test]
    fn parses_registry_multiline_hex_value() {
        let raw = r#"
Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Test]
"Multi"=hex(7):41,00,00,00,\
  42,00,00,00,00,00
"#;

        let (entries, warnings) = parse_reg_file_entries(raw);
        assert!(warnings.is_empty(), "unexpected warnings: {warnings:?}");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].path, r"HKEY_CURRENT_USER\Software\Test");
        assert_eq!(entries[0].name, "Multi");
        assert_eq!(entries[0].value_type, "REG_MULTI_SZ");
        assert_eq!(entries[0].value, "41,00,00,00,42,00,00,00,00,00");
    }

    #[test]
    fn parses_case_insensitive_dword_prefix() {
        let raw = r#"
Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Test]
"Flag"=DWORD:00000001
"#;

        let (entries, warnings) = parse_reg_file_entries(raw);
        assert!(warnings.is_empty(), "unexpected warnings: {warnings:?}");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].value_type, "REG_DWORD");
        assert_eq!(entries[0].value, "00000001");
    }

    #[test]
    fn warns_on_invalid_hex_token_but_keeps_entry() {
        let raw = r#"
Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Test]
"Broken"=hex:aa,zz,10
"#;

        let (entries, warnings) = parse_reg_file_entries(raw);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].value_type, "REG_BINARY");
        assert_eq!(entries[0].value, "aa,zz,10");
        assert!(!warnings.is_empty());
    }
}
