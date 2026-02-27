use std::path::PathBuf;

use luthier_core::CreateOrchestratorRequest;
use luthier_orchestrator_core::GameConfig;

use crate::application::ports::{
    BackendLogEvent, BackendLogLevel, BackendLoggerPort, LuthierCorePort,
};
use crate::error::{BackendError, BackendResult, BackendResultExt, CommandStringResult};
use crate::models::dto::{CreateExecutableInput, CreateExecutableOutput};

pub trait BaseBinaryResolverPort: Send + Sync {
    fn resolve_base_orchestrator_binary(
        &self,
        requested: &str,
        extra_hints: &[PathBuf],
    ) -> BackendResult<PathBuf>;
    fn collect_base_orchestrator_binary_candidates(
        &self,
        requested: &str,
        extra_hints: &[PathBuf],
    ) -> Vec<PathBuf>;
}

pub struct CreateExecutableUseCase<'a> {
    luthier_core: &'a dyn LuthierCorePort,
    base_binary_resolver: &'a dyn BaseBinaryResolverPort,
    logger: &'a dyn BackendLoggerPort,
}

impl<'a> CreateExecutableUseCase<'a> {
    pub fn new(
        luthier_core: &'a dyn LuthierCorePort,
        base_binary_resolver: &'a dyn BaseBinaryResolverPort,
        logger: &'a dyn BackendLoggerPort,
    ) -> Self {
        Self {
            luthier_core,
            base_binary_resolver,
            logger,
        }
    }

    pub fn execute(&self, input: CreateExecutableInput) -> BackendResult<CreateExecutableOutput> {
        self.execute_with_base_hints(input, &[])
    }

    pub fn execute_with_base_hints(
        &self,
        input: CreateExecutableInput,
        base_binary_hints: &[PathBuf],
    ) -> BackendResult<CreateExecutableOutput> {
        self.log_info(
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
            .map_err(|err| BackendError::internal(format!("invalid config JSON: {err}")))?;

        self.log_base_orchestrator_resolution_attempts(&input.base_binary_path, base_binary_hints);
        let resolved_base_binary_path = self
            .base_binary_resolver
            .resolve_base_orchestrator_binary(&input.base_binary_path, base_binary_hints)?;

        self.log_info(
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

        self.luthier_core
            .validate_game_config(&request.config)
            .map_err(|err| {
                self.log_create_failed(&err, &request.base_binary_path, &request.output_path);
                err
            })?;

        let result = self
            .luthier_core
            .create_orchestrator_binary(&request)
            .map_err(|err| {
                self.log_create_failed(&err, &request.base_binary_path, &request.output_path);
                err
            })?;

        let icon_sidecar_path = None;

        self.log_info(
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

    fn log_base_orchestrator_resolution_attempts(&self, requested: &str, extra_hints: &[PathBuf]) {
        let attempted = self
            .base_binary_resolver
            .collect_base_orchestrator_binary_candidates(requested, extra_hints)
            .into_iter()
            .map(|path| path.to_string_lossy().into_owned())
            .collect::<Vec<_>>();

        self.log_info(
            "GO-CR-011",
            "resolving_base_orchestrator_binary",
            serde_json::json!({
                "requested": requested.trim(),
                "extra_hints_count": extra_hints.len(),
                "attempted_candidates": attempted,
            }),
        );
    }

    fn log_create_failed(
        &self,
        err: &BackendError,
        base_binary_path: &std::path::Path,
        output_path: &std::path::Path,
    ) {
        self.log_error(
            "GO-CR-090",
            "create_executable_failed",
            serde_json::json!({
                "error": err.to_string(),
                "base_binary_path": base_binary_path,
                "output_path": output_path,
                "validation_issues": Self::validation_issues_from_error(err),
            }),
        );
    }

    fn validation_issues_from_error(err: &BackendError) -> Option<Vec<serde_json::Value>> {
        err.details()
            .and_then(|details| details.get("validation_issues"))
            .and_then(|issues| issues.as_array())
            .map(|issues| {
                issues
                    .iter()
                    .map(|issue| {
                        serde_json::json!({
                            "code": issue.get("code").cloned().unwrap_or(serde_json::Value::Null),
                            "field": issue.get("field").cloned().unwrap_or(serde_json::Value::Null),
                            "message": issue
                                .get("message")
                                .cloned()
                                .unwrap_or(serde_json::Value::Null),
                        })
                    })
                    .collect::<Vec<serde_json::Value>>()
            })
    }

    fn log_info(&self, event_code: &str, message: &str, context: serde_json::Value) {
        self.log(BackendLogLevel::Info, event_code, message, context);
    }

    fn log_error(&self, event_code: &str, message: &str, context: serde_json::Value) {
        self.log(BackendLogLevel::Error, event_code, message, context);
    }

    fn log(
        &self,
        level: BackendLogLevel,
        event_code: &str,
        message: &str,
        context: serde_json::Value,
    ) {
        let _ = self.logger.log(&BackendLogEvent {
            level,
            event_code: event_code.to_string(),
            message: message.to_string(),
            context,
        });
    }
}

pub fn create_executable(
    input: CreateExecutableInput,
    luthier_core: &dyn LuthierCorePort,
    base_binary_resolver: &dyn BaseBinaryResolverPort,
    logger: &dyn BackendLoggerPort,
) -> BackendResult<CreateExecutableOutput> {
    CreateExecutableUseCase::new(luthier_core, base_binary_resolver, logger).execute(input)
}

pub fn create_executable_with_base_hints(
    input: CreateExecutableInput,
    base_binary_hints: &[PathBuf],
    luthier_core: &dyn LuthierCorePort,
    base_binary_resolver: &dyn BaseBinaryResolverPort,
    logger: &dyn BackendLoggerPort,
) -> BackendResult<CreateExecutableOutput> {
    CreateExecutableUseCase::new(luthier_core, base_binary_resolver, logger)
        .execute_with_base_hints(input, base_binary_hints)
}

pub fn create_executable_command(
    input: CreateExecutableInput,
    luthier_core: &dyn LuthierCorePort,
    base_binary_resolver: &dyn BaseBinaryResolverPort,
    logger: &dyn BackendLoggerPort,
) -> CommandStringResult<CreateExecutableOutput> {
    CreateExecutableUseCase::new(luthier_core, base_binary_resolver, logger)
        .execute_command_string(input)
}

pub fn create_executable_with_base_hints_command(
    input: CreateExecutableInput,
    base_binary_hints: &[PathBuf],
    luthier_core: &dyn LuthierCorePort,
    base_binary_resolver: &dyn BaseBinaryResolverPort,
    logger: &dyn BackendLoggerPort,
) -> CommandStringResult<CreateExecutableOutput> {
    CreateExecutableUseCase::new(luthier_core, base_binary_resolver, logger)
        .execute_with_base_hints_command_string(input, base_binary_hints)
}
