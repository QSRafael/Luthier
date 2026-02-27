use std::path::Path;

use crate::application::ports::{
    BackendLogEvent, BackendLogLevel, BackendLoggerPort, FileSystemPort, RegistryParserPort,
};
use crate::error::{BackendResult, BackendResultExt, CommandStringResult};
use crate::models::dto::{ImportRegistryFileInput, ImportRegistryFileOutput};

pub struct ImportRegistryUseCase<'a> {
    file_system: &'a dyn FileSystemPort,
    registry_parser: &'a dyn RegistryParserPort,
    logger: &'a dyn BackendLoggerPort,
}

impl<'a> ImportRegistryUseCase<'a> {
    pub fn new(
        file_system: &'a dyn FileSystemPort,
        registry_parser: &'a dyn RegistryParserPort,
        logger: &'a dyn BackendLoggerPort,
    ) -> Self {
        Self {
            file_system,
            registry_parser,
            logger,
        }
    }

    pub fn execute(
        &self,
        input: ImportRegistryFileInput,
    ) -> BackendResult<ImportRegistryFileOutput> {
        self.log_info(
            "GO-CR-401",
            "import_registry_file_requested",
            serde_json::json!({ "path": input.path }),
        );

        let bytes = self
            .file_system
            .read_bytes(Path::new(&input.path))
            .map_err(|err| err.with_context("failed to read .reg file"))?;
        let raw = self.registry_parser.decode_text(&bytes)?;
        let parsed = self.registry_parser.parse_entries(&raw);
        let entries = parsed.entries;
        let warnings = parsed.warnings;

        if entries.is_empty() {
            return Err("no importable registry entries found in .reg file"
                .to_string()
                .into());
        }

        let out = ImportRegistryFileOutput { entries, warnings };

        self.log_info(
            "GO-CR-402",
            "import_registry_file_completed",
            serde_json::json!({
                "path": input.path,
                "entries_count": out.entries.len(),
                "warnings_count": out.warnings.len(),
            }),
        );

        Ok(out)
    }

    pub fn execute_command_string(
        &self,
        input: ImportRegistryFileInput,
    ) -> CommandStringResult<ImportRegistryFileOutput> {
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

pub fn import_registry_file_command(
    input: ImportRegistryFileInput,
    file_system: &dyn FileSystemPort,
    registry_parser: &dyn RegistryParserPort,
    logger: &dyn BackendLoggerPort,
) -> CommandStringResult<ImportRegistryFileOutput> {
    ImportRegistryUseCase::new(file_system, registry_parser, logger).execute_command_string(input)
}
