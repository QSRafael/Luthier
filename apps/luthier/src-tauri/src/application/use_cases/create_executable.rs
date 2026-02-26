use std::path::PathBuf;

use luthier_core::{CreateOrchestratorRequest, create_orchestrator_binary};
use luthier_orchestrator_core::GameConfig;

use crate::error::{BackendResult, BackendResultExt, CommandStringResult};
use crate::infrastructure::{fs_repo, logging::log_backend_event};
use crate::models::dto::{CreateExecutableInput, CreateExecutableOutput};

#[derive(Debug, Clone, Copy, Default)]
pub struct CreateExecutableUseCase;

impl CreateExecutableUseCase {
    pub fn new() -> Self {
        Self
    }

    pub fn execute(&self, input: CreateExecutableInput) -> BackendResult<CreateExecutableOutput> {
        self.execute_with_base_hints(input, &[])
    }

    pub fn execute_with_base_hints(
        &self,
        input: CreateExecutableInput,
        base_binary_hints: &[PathBuf],
    ) -> BackendResult<CreateExecutableOutput> {
        log_backend_event(
            "INFO",
            "GO-CR-001",
            "create_executable_requested",
            serde_json::json!({
                "requested_base_binary_path": &input.base_binary_path,
                "output_path": &input.output_path,
                "backup_existing": input.backup_existing,
                "make_executable": input.make_executable,
                "has_icon_png_data_url": input.icon_png_data_url.as_ref().is_some_and(|value| !value.trim().is_empty()),
                "hints_count": base_binary_hints.len(),
            }),
        );

        let config: GameConfig = serde_json::from_str(&input.config_json)
            .map_err(|err| format!("invalid config JSON: {err}"))?;

        self.log_base_orchestrator_resolution_attempts(&input.base_binary_path, base_binary_hints);
        let resolved_base_binary_path =
            fs_repo::resolve_base_orchestrator_binary(&input.base_binary_path, base_binary_hints)?;

        log_backend_event(
            "INFO",
            "GO-CR-010",
            "base_orchestrator_binary_resolved",
            serde_json::json!({
                "resolved_base_binary_path": resolved_base_binary_path,
            }),
        );

        let request = CreateOrchestratorRequest {
            base_binary_path: resolved_base_binary_path.clone(),
            output_path: PathBuf::from(&input.output_path),
            config,
            backup_existing: input.backup_existing,
            make_executable: input.make_executable,
        };

        let result = create_orchestrator_binary(&request).map_err(|err| {
            let message = err.to_string();
            let validation_issues = err.validation_issues().map(|issues| {
                issues
                    .iter()
                    .map(|issue| {
                        serde_json::json!({
                            "code": issue.code,
                            "field": issue.field,
                            "message": issue.message,
                        })
                    })
                    .collect::<Vec<serde_json::Value>>()
            });
            log_backend_event(
                "ERROR",
                "GO-CR-090",
                "create_executable_failed",
                serde_json::json!({
                    "error": message,
                    "base_binary_path": &request.base_binary_path,
                    "output_path": &request.output_path,
                    "validation_issues": validation_issues,
                }),
            );
            err
        })?;

        let icon_sidecar_path = None;

        log_backend_event(
            "INFO",
            "GO-CR-020",
            "create_executable_completed",
            serde_json::json!({
                "output_path": &result.output_path,
                "config_size_bytes": result.config_size_bytes,
                "config_sha256_hex": &result.config_sha256_hex,
                "resolved_base_binary_path": &resolved_base_binary_path,
                "icon_sidecar_path": &icon_sidecar_path,
            }),
        );

        Ok(CreateExecutableOutput {
            output_path: result.output_path,
            config_size_bytes: result.config_size_bytes,
            config_sha256_hex: result.config_sha256_hex,
            resolved_base_binary_path: request.base_binary_path.to_string_lossy().into_owned(),
            icon_sidecar_path,
        })
    }

    pub fn execute_command_string(
        &self,
        input: CreateExecutableInput,
    ) -> CommandStringResult<CreateExecutableOutput> {
        self.execute(input).into_command_string_result()
    }

    pub fn execute_with_base_hints_command_string(
        &self,
        input: CreateExecutableInput,
        base_binary_hints: &[PathBuf],
    ) -> CommandStringResult<CreateExecutableOutput> {
        self.execute_with_base_hints(input, base_binary_hints)
            .into_command_string_result()
    }

    fn log_base_orchestrator_resolution_attempts(
        &self,
        requested: &str,
        extra_hints: &[PathBuf],
    ) {
        let attempted = fs_repo::collect_base_orchestrator_binary_candidates(requested, extra_hints)
            .into_iter()
            .map(|path| path.to_string_lossy().into_owned())
            .collect::<Vec<_>>();

        log_backend_event(
            "INFO",
            "GO-CR-011",
            "resolving_base_orchestrator_binary",
            serde_json::json!({
                "requested": requested.trim(),
                "extra_hints_count": extra_hints.len(),
                "attempted_candidates": attempted,
            }),
        );
    }
}

pub fn create_executable(input: CreateExecutableInput) -> BackendResult<CreateExecutableOutput> {
    CreateExecutableUseCase::new().execute(input)
}

pub fn create_executable_with_base_hints(
    input: CreateExecutableInput,
    base_binary_hints: &[PathBuf],
) -> BackendResult<CreateExecutableOutput> {
    CreateExecutableUseCase::new().execute_with_base_hints(input, base_binary_hints)
}

pub fn create_executable_command(
    input: CreateExecutableInput,
) -> CommandStringResult<CreateExecutableOutput> {
    CreateExecutableUseCase::new().execute_command_string(input)
}

pub fn create_executable_with_base_hints_command(
    input: CreateExecutableInput,
    base_binary_hints: &[PathBuf],
) -> CommandStringResult<CreateExecutableOutput> {
    CreateExecutableUseCase::new().execute_with_base_hints_command_string(input, base_binary_hints)
}
