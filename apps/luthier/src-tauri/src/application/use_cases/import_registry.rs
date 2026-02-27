use std::path::Path;

use crate::error::{BackendResult, BackendResultExt, CommandStringResult};
use crate::infrastructure::{fs_repo, logging::log_backend_event, registry_parser};
use crate::models::dto::{ImportRegistryFileInput, ImportRegistryFileOutput};

#[derive(Debug, Clone, Copy, Default)]
pub struct ImportRegistryUseCase;

impl ImportRegistryUseCase {
    pub fn new() -> Self {
        Self
    }

    pub fn execute(
        &self,
        input: ImportRegistryFileInput,
    ) -> BackendResult<ImportRegistryFileOutput> {
        log_backend_event(
            "INFO",
            "GO-CR-401",
            "import_registry_file_requested",
            serde_json::json!({ "path": input.path }),
        );

        let bytes = fs_repo::read_bytes(Path::new(&input.path))
            .map_err(|err| err.with_context("failed to read .reg file"))?;
        let raw = registry_parser::decode_reg_file_text(&bytes)?;
        let (entries, warnings) = registry_parser::parse_reg_file_entries(&raw);

        if entries.is_empty() {
            return Err("no importable registry entries found in .reg file"
                .to_string()
                .into());
        }

        let out = ImportRegistryFileOutput { entries, warnings };

        log_backend_event(
            "INFO",
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
}

pub fn import_registry_file(
    input: ImportRegistryFileInput,
) -> BackendResult<ImportRegistryFileOutput> {
    ImportRegistryUseCase::new().execute(input)
}

pub fn import_registry_file_command(
    input: ImportRegistryFileInput,
) -> CommandStringResult<ImportRegistryFileOutput> {
    ImportRegistryUseCase::new().execute_command_string(input)
}
