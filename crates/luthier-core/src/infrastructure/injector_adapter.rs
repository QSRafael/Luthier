use std::path::{Path, PathBuf};

use luthier_orchestrator_core::injector::{
    inject_from_parts as orchestrator_inject_from_parts, InjectOptions as OrchestratorInjectOptions,
};

use crate::LuthierError;

#[derive(Debug, Clone, Copy)]
pub(crate) struct OrchestratorInjectionOptions {
    pub backup_existing: bool,
    pub make_executable: bool,
}

impl Default for OrchestratorInjectionOptions {
    fn default() -> Self {
        Self {
            backup_existing: true,
            make_executable: true,
        }
    }
}

impl From<OrchestratorInjectionOptions> for OrchestratorInjectOptions {
    fn from(value: OrchestratorInjectionOptions) -> Self {
        Self {
            backup_existing: value.backup_existing,
            make_executable: value.make_executable,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct OrchestratorInjectionRequest<'a> {
    pub base_bytes: &'a [u8],
    pub config_bytes: &'a [u8],
    pub output_path: &'a Path,
    pub options: OrchestratorInjectionOptions,
}

#[derive(Debug, Clone)]
pub(crate) struct OrchestratorInjectionResult {
    pub output_path: PathBuf,
    pub config_len: usize,
    pub config_sha256_hex: String,
}

pub(crate) fn inject_orchestrator_payload(
    request: OrchestratorInjectionRequest<'_>,
) -> Result<OrchestratorInjectionResult, LuthierError> {
    let result = orchestrator_inject_from_parts(
        request.base_bytes,
        request.config_bytes,
        request.output_path,
        request.options.into(),
    )?;

    Ok(OrchestratorInjectionResult {
        output_path: result.output_path,
        config_len: result.config_len,
        config_sha256_hex: result.config_sha256_hex,
    })
}
