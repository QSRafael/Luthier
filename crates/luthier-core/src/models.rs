use std::path::PathBuf;

use luthier_orchestrator_core::GameConfig;
use serde::{Deserialize, Serialize};

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

#[derive(Debug, Clone)]
pub struct Sha256FileRequest {
    pub path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Sha256FileResult {
    pub sha256_hex: String,
}

#[derive(Debug, Clone)]
pub struct ToRelativeInsideGameRootRequest {
    pub game_root: PathBuf,
    pub candidate: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ToRelativeInsideGameRootResult {
    pub relative_path: String,
}
