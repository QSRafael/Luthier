use crate::infrastructure::file_io;
use crate::infrastructure::injector_adapter::{
    self, OrchestratorInjectionOptions, OrchestratorInjectionRequest,
};
use crate::{CreateOrchestratorRequest, CreateOrchestratorResult, LuthierError};

pub(crate) fn create_orchestrator_binary(
    request: &CreateOrchestratorRequest,
) -> Result<CreateOrchestratorResult, LuthierError> {
    super::validate_game_config::validate_game_config(&request.config)?;

    let base_bytes = file_io::read_bytes(&request.base_binary_path)?;
    let config_bytes = serde_json::to_vec_pretty(&request.config)?;

    let inject_result = injector_adapter::inject_orchestrator_payload(OrchestratorInjectionRequest {
        base_bytes: &base_bytes,
        config_bytes: &config_bytes,
        output_path: &request.output_path,
        options: OrchestratorInjectionOptions {
            backup_existing: request.backup_existing,
            make_executable: request.make_executable,
        },
    })?;

    Ok(CreateOrchestratorResult {
        output_path: inject_result.output_path.to_string_lossy().into_owned(),
        config_size_bytes: inject_result.config_len,
        config_sha256_hex: inject_result.config_sha256_hex,
    })
}
