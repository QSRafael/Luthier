use std::path::PathBuf;

use crate::application::ports::{
    BackendLogEvent, BackendLogLevel, BackendLoggerPort, LuthierCorePort,
};
use crate::error::{BackendResult, BackendResultExt, CommandStringResult};
use crate::models::dto::{HashExeInput, HashExeOutput};

pub struct HashExecutableUseCase<'a> {
    luthier_core: &'a dyn LuthierCorePort,
    logger: &'a dyn BackendLoggerPort,
}

impl<'a> HashExecutableUseCase<'a> {
    pub fn new(
        luthier_core: &'a dyn LuthierCorePort,
        logger: &'a dyn BackendLoggerPort,
    ) -> Self {
        Self {
            luthier_core,
            logger,
        }
    }

    pub fn execute(&self, input: HashExeInput) -> BackendResult<HashExeOutput> {
        let path = PathBuf::from(input.executable_path);

        self.log_info(
            "GO-CR-101",
            "hash_executable_requested",
            serde_json::json!({ "path": path }),
        );

        let hash = self.luthier_core.sha256_file(&path)?;

        self.log_info(
            "GO-CR-102",
            "hash_executable_completed",
            serde_json::json!({ "path": path, "sha256_hex": hash }),
        );

        Ok(HashExeOutput { sha256_hex: hash })
    }

    pub fn execute_command_string(&self, input: HashExeInput) -> CommandStringResult<HashExeOutput> {
        self.execute(input).into_command_string_result()
    }

    fn log_info(&self, event_code: &str, message: &str, context: serde_json::Value) {
        let _ = self.logger.log(&BackendLogEvent {
            level: BackendLogLevel::Info,
            event_code: event_code.to_string(),
            message: message.to_string(),
            context,
        });
    }
}

pub fn hash_executable(
    input: HashExeInput,
    luthier_core: &dyn LuthierCorePort,
    logger: &dyn BackendLoggerPort,
) -> BackendResult<HashExeOutput> {
    HashExecutableUseCase::new(luthier_core, logger).execute(input)
}

pub fn hash_executable_command(
    input: HashExeInput,
    luthier_core: &dyn LuthierCorePort,
    logger: &dyn BackendLoggerPort,
) -> CommandStringResult<HashExeOutput> {
    HashExecutableUseCase::new(luthier_core, logger).execute_command_string(input)
}

