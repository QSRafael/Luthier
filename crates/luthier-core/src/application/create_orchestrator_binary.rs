use crate::application::ports::{
    OrchestratorBinaryReaderPort, OrchestratorPayloadInjectionOptions,
    OrchestratorPayloadInjectionRequest, OrchestratorPayloadInjectorPort,
};
use crate::{CreateOrchestratorRequest, CreateOrchestratorResult, LuthierError};

pub(crate) fn create_orchestrator_binary(
    request: &CreateOrchestratorRequest,
    binary_reader: &dyn OrchestratorBinaryReaderPort,
    payload_injector: &dyn OrchestratorPayloadInjectorPort,
) -> Result<CreateOrchestratorResult, LuthierError> {
    super::validate_game_config::validate_game_config(&request.config)?;

    let base_bytes = binary_reader.read_bytes(&request.base_binary_path)?;
    let config_bytes = serde_json::to_vec_pretty(&request.config)?;

    let inject_result =
        payload_injector.inject_orchestrator_payload(OrchestratorPayloadInjectionRequest {
            base_bytes: &base_bytes,
            config_bytes: &config_bytes,
            output_path: &request.output_path,
            options: OrchestratorPayloadInjectionOptions {
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
