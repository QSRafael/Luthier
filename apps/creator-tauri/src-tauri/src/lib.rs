use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::process::Command;

use creator_core::{create_orchestrator_binary, sha256_file, CreateOrchestratorRequest};
use orchestrator_core::{doctor::run_doctor, prefix::build_prefix_setup_plan, GameConfig};
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
}
