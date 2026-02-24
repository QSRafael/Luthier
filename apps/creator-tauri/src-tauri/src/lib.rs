use std::path::PathBuf;

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
    let missing_files = collect_missing_files(&config, &game_root);
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

#[cfg_attr(feature = "tauri-commands", tauri::command)]
pub fn cmd_create_executable(
    input: CreateExecutableInput,
) -> Result<CreateExecutableOutput, String> {
    create_executable(input)
}

#[cfg_attr(feature = "tauri-commands", tauri::command)]
pub fn cmd_hash_executable(input: HashExeInput) -> Result<HashExeOutput, String> {
    hash_executable(input)
}

#[cfg_attr(feature = "tauri-commands", tauri::command)]
pub fn cmd_test_configuration(
    input: TestConfigurationInput,
) -> Result<TestConfigurationOutput, String> {
    test_configuration(input)
}

fn collect_missing_files(config: &GameConfig, game_root: &PathBuf) -> Vec<String> {
    let mut missing = Vec::new();

    let exe_path = resolve_relative_path(game_root, &config.relative_exe_path);
    if !exe_path.exists() {
        missing.push(config.relative_exe_path.clone());
    }

    for file in &config.integrity_files {
        let path = resolve_relative_path(game_root, file);
        if !path.exists() {
            missing.push(file.clone());
        }
    }

    missing
}

fn resolve_relative_path(base: &PathBuf, relative: &str) -> PathBuf {
    let clean = relative.strip_prefix("./").unwrap_or(relative);
    base.join(clean)
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
        let err = cmd_hash_executable(input).expect_err("missing file must fail");
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
}
