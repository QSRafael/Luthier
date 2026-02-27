use std::path::PathBuf;

use luthier_core::validate_game_config;
use luthier_orchestrator_core::{
    doctor::{run_doctor, CheckStatus},
    prefix::build_prefix_setup_plan,
    GameConfig,
};

use crate::error::{BackendResult, BackendResultExt, CommandStringResult};
use crate::infrastructure::{fs_repo, logging::log_backend_event};
use crate::models::dto::{TestConfigurationInput, TestConfigurationOutput};

#[derive(Debug, Clone, Copy, Default)]
pub struct TestConfigurationUseCase;

impl TestConfigurationUseCase {
    pub fn new() -> Self {
        Self
    }

    pub fn execute(&self, input: TestConfigurationInput) -> BackendResult<TestConfigurationOutput> {
        log_backend_event(
            "INFO",
            "GO-CR-201",
            "test_configuration_requested",
            serde_json::json!({
                "game_root": input.game_root,
                "config_json_len": input.config_json.len(),
            }),
        );

        let config: GameConfig = serde_json::from_str(&input.config_json)
            .map_err(|err| format!("invalid config JSON: {err}"))?;

        validate_game_config(&config).map_err(|err| {
            log_backend_event(
                "ERROR",
                "GO-CR-291",
                "test_configuration_payload_validation_failed",
                serde_json::json!({
                    "error": err.to_string(),
                    "validation_issues": err.validation_issues().map(|issues| {
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
                    }),
                }),
            );
            err.to_string()
        })?;

        let game_root = PathBuf::from(&input.game_root);
        let missing_files = fs_repo::collect_missing_files(&config, &game_root)?;
        let doctor = run_doctor(Some(&config));
        let prefix_plan = build_prefix_setup_plan(&config).map_err(|err| err.to_string())?;

        let has_blocker = matches!(doctor.summary, CheckStatus::BLOCKER);
        let status = if has_blocker || !missing_files.is_empty() {
            "BLOCKER"
        } else {
            "OK"
        };

        let out = TestConfigurationOutput {
            status: status.to_string(),
            missing_files,
            doctor: serde_json::to_value(doctor).map_err(|err| err.to_string())?,
            prefix_setup_plan: serde_json::to_value(prefix_plan).map_err(|err| err.to_string())?,
        };

        log_backend_event(
            "INFO",
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
}

pub fn test_configuration(input: TestConfigurationInput) -> BackendResult<TestConfigurationOutput> {
    TestConfigurationUseCase::new().execute(input)
}

pub fn test_configuration_command(
    input: TestConfigurationInput,
) -> CommandStringResult<TestConfigurationOutput> {
    TestConfigurationUseCase::new().execute_command_string(input)
}
