use std::path::PathBuf;

use creator_core::{create_orchestrator_binary, sha256_file, CreateOrchestratorRequest};
use orchestrator_core::GameConfig;
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
}
