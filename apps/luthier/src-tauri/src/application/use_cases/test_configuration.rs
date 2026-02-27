use std::path::{Path, PathBuf};

use luthier_orchestrator_core::{doctor::CheckStatus, GameConfig};

use crate::application::ports::{
    BackendLogEvent, BackendLogLevel, BackendLoggerPort, FileSystemPort, JsonCodecPort,
    LuthierCorePort, OrchestratorRuntimeInspectorPort,
};
use crate::domain::paths as domain_paths;
use crate::error::{BackendError, BackendResult, BackendResultExt, CommandStringResult};
use crate::models::dto::{TestConfigurationInput, TestConfigurationOutput};

pub struct TestConfigurationUseCase<'a> {
    luthier_core: &'a dyn LuthierCorePort,
    file_system: &'a dyn FileSystemPort,
    runtime_inspector: &'a dyn OrchestratorRuntimeInspectorPort,
    json_codec: &'a dyn JsonCodecPort,
    logger: &'a dyn BackendLoggerPort,
}

impl<'a> TestConfigurationUseCase<'a> {
    pub fn new(
        luthier_core: &'a dyn LuthierCorePort,
        file_system: &'a dyn FileSystemPort,
        runtime_inspector: &'a dyn OrchestratorRuntimeInspectorPort,
        json_codec: &'a dyn JsonCodecPort,
        logger: &'a dyn BackendLoggerPort,
    ) -> Self {
        Self {
            luthier_core,
            file_system,
            runtime_inspector,
            json_codec,
            logger,
        }
    }

    pub fn execute(&self, input: TestConfigurationInput) -> BackendResult<TestConfigurationOutput> {
        self.log_info(
            "GO-CR-201",
            "test_configuration_requested",
            serde_json::json!({
                "game_root": input.game_root,
                "config_json_len": input.config_json.len(),
            }),
        );

        let config = self.json_codec.parse_game_config(&input.config_json)?;

        self.luthier_core
            .validate_game_config(&config)
            .map_err(|err| {
                self.log_validation_failed(&err);
                err
            })?;

        let game_root = PathBuf::from(&input.game_root);
        let missing_files = self.collect_missing_files(&config, &game_root)?;
        let doctor = self.runtime_inspector.run_doctor(Some(&config))?;
        let prefix_plan = self.runtime_inspector.build_prefix_setup_plan(&config)?;

        let has_blocker = matches!(doctor.summary, CheckStatus::BLOCKER);
        let status = if has_blocker || !missing_files.is_empty() {
            "BLOCKER"
        } else {
            "OK"
        };

        let out = TestConfigurationOutput {
            status: status.to_string(),
            missing_files,
            doctor: self.json_codec.to_json_value_doctor_report(&doctor)?,
            prefix_setup_plan: self
                .json_codec
                .to_json_value_prefix_setup_plan(&prefix_plan)?,
        };

        self.log_info(
            "GO-CR-202",
            "test_configuration_completed",
            serde_json::json!({
                "status": out.status,
                "missing_files_count": out.missing_files.len(),
            }),
        );

        Ok(out)
    }

    pub fn execute_command_string(
        &self,
        input: TestConfigurationInput,
    ) -> CommandStringResult<TestConfigurationOutput> {
        self.execute(input).into_command_string_result()
    }

    fn collect_missing_files(
        &self,
        config: &GameConfig,
        game_root: &Path,
    ) -> BackendResult<Vec<String>> {
        let mut missing = Vec::new();

        let exe_path = domain_paths::resolve_relative_path(game_root, &config.relative_exe_path)?;
        if !self.file_system.exists(&exe_path) {
            missing.push(config.relative_exe_path.clone());
        }

        for file in &config.integrity_files {
            let path = domain_paths::resolve_relative_path(game_root, file)?;
            if !self.file_system.exists(&path) {
                missing.push(file.clone());
            }
        }

        Ok(missing)
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

    fn log_validation_failed(&self, err: &BackendError) {
        self.log_error(
            "GO-CR-291",
            "test_configuration_payload_validation_failed",
            serde_json::json!({
                "error": err.to_string(),
                "validation_issues": Self::validation_issues_from_error(err),
            }),
        );
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

pub fn test_configuration(
    input: TestConfigurationInput,
    luthier_core: &dyn LuthierCorePort,
    file_system: &dyn FileSystemPort,
    runtime_inspector: &dyn OrchestratorRuntimeInspectorPort,
    json_codec: &dyn JsonCodecPort,
    logger: &dyn BackendLoggerPort,
) -> BackendResult<TestConfigurationOutput> {
    TestConfigurationUseCase::new(
        luthier_core,
        file_system,
        runtime_inspector,
        json_codec,
        logger,
    )
    .execute(input)
}

pub fn test_configuration_command(
    input: TestConfigurationInput,
    luthier_core: &dyn LuthierCorePort,
    file_system: &dyn FileSystemPort,
    runtime_inspector: &dyn OrchestratorRuntimeInspectorPort,
    json_codec: &dyn JsonCodecPort,
    logger: &dyn BackendLoggerPort,
) -> CommandStringResult<TestConfigurationOutput> {
    TestConfigurationUseCase::new(
        luthier_core,
        file_system,
        runtime_inspector,
        json_codec,
        logger,
    )
    .execute_command_string(input)
}
