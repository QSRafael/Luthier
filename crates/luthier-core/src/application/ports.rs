use std::path::{Path, PathBuf};

use crate::LuthierError;

pub trait OrchestratorBinaryReaderPort: Send + Sync {
    fn read_bytes(&self, path: &Path) -> Result<Vec<u8>, LuthierError>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OrchestratorPayloadInjectionOptions {
    pub backup_existing: bool,
    pub make_executable: bool,
}

impl Default for OrchestratorPayloadInjectionOptions {
    fn default() -> Self {
        Self {
            backup_existing: true,
            make_executable: true,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct OrchestratorPayloadInjectionRequest<'a> {
    pub base_bytes: &'a [u8],
    pub config_bytes: &'a [u8],
    pub output_path: &'a Path,
    pub options: OrchestratorPayloadInjectionOptions,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OrchestratorPayloadInjectionResult {
    pub output_path: PathBuf,
    pub config_len: usize,
    pub config_sha256_hex: String,
}

pub trait OrchestratorPayloadInjectorPort: Send + Sync {
    fn inject_orchestrator_payload(
        &self,
        request: OrchestratorPayloadInjectionRequest<'_>,
    ) -> Result<OrchestratorPayloadInjectionResult, LuthierError>;
}
