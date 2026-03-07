use std::path::Path;

use luthier_orchestrator_core::trailer;

use crate::application::ports::{
    BackendLogEvent, BackendLogLevel, BackendLoggerPort, FileSystemPort,
};
use crate::error::{BackendError, BackendResult, BackendResultExt, CommandStringResult};
use crate::models::dto::{ReadPayloadFileInput, ReadPayloadFileOutput};

pub struct PayloadImportUseCase<'a> {
    file_system: &'a dyn FileSystemPort,
    logger: &'a dyn BackendLoggerPort,
}

impl<'a> PayloadImportUseCase<'a> {
    pub fn new(file_system: &'a dyn FileSystemPort, logger: &'a dyn BackendLoggerPort) -> Self {
        Self {
            file_system,
            logger,
        }
    }

    pub fn read_payload_json_file(
        &self,
        input: ReadPayloadFileInput,
    ) -> BackendResult<ReadPayloadFileOutput> {
        self.log_info(
            "GO-CR-601",
            "read_payload_json_file_requested",
            serde_json::json!({ "path": &input.path }),
        );

        let payload_json = self.read_utf8_file(&input.path)?;

        if payload_json.trim().is_empty() {
            return Err(BackendError::validation("payload json file is empty"));
        }

        let out = ReadPayloadFileOutput { payload_json };

        self.log_info(
            "GO-CR-602",
            "read_payload_json_file_completed",
            serde_json::json!({
                "path": &input.path,
                "payload_len": out.payload_json.len(),
            }),
        );

        Ok(out)
    }

    pub fn extract_payload_json_from_orchestrator(
        &self,
        input: ReadPayloadFileInput,
    ) -> BackendResult<ReadPayloadFileOutput> {
        self.log_info(
            "GO-CR-603",
            "extract_payload_json_from_orchestrator_requested",
            serde_json::json!({ "path": &input.path }),
        );

        let executable_bytes = self
            .file_system
            .read_bytes(Path::new(&input.path))
            .map_err(|err| err.with_context("failed to read orchestrator executable"))?;

        let payload_bytes = trailer::extract_config_json(&executable_bytes)
            .map_err(BackendError::from)
            .map_err(|err| err.with_context("failed to extract payload from orchestrator"))?;

        let payload_json = std::str::from_utf8(payload_bytes)
            .map_err(BackendError::from)
            .map_err(|err| err.with_context("payload bytes are not valid UTF-8"))?
            .to_owned();

        if payload_json.trim().is_empty() {
            return Err(BackendError::validation(
                "embedded payload json is empty in orchestrator executable",
            ));
        }

        let out = ReadPayloadFileOutput { payload_json };

        self.log_info(
            "GO-CR-604",
            "extract_payload_json_from_orchestrator_completed",
            serde_json::json!({
                "path": &input.path,
                "payload_len": out.payload_json.len(),
            }),
        );

        Ok(out)
    }

    pub fn read_payload_json_file_command_string(
        &self,
        input: ReadPayloadFileInput,
    ) -> CommandStringResult<ReadPayloadFileOutput> {
        self.read_payload_json_file(input)
            .into_command_string_result()
    }

    pub fn extract_payload_json_from_orchestrator_command_string(
        &self,
        input: ReadPayloadFileInput,
    ) -> CommandStringResult<ReadPayloadFileOutput> {
        self.extract_payload_json_from_orchestrator(input)
            .into_command_string_result()
    }

    fn read_utf8_file(&self, path: &str) -> BackendResult<String> {
        let bytes = self
            .file_system
            .read_bytes(Path::new(path))
            .map_err(|err| err.with_context("failed to read payload json file"))?;

        String::from_utf8(bytes)
            .map_err(BackendError::from)
            .map_err(|err| err.with_context("payload json file is not valid UTF-8"))
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

pub fn read_payload_json_file_command(
    input: ReadPayloadFileInput,
    file_system: &dyn FileSystemPort,
    logger: &dyn BackendLoggerPort,
) -> CommandStringResult<ReadPayloadFileOutput> {
    PayloadImportUseCase::new(file_system, logger).read_payload_json_file_command_string(input)
}

pub fn extract_payload_json_from_orchestrator_command(
    input: ReadPayloadFileInput,
    file_system: &dyn FileSystemPort,
    logger: &dyn BackendLoggerPort,
) -> CommandStringResult<ReadPayloadFileOutput> {
    PayloadImportUseCase::new(file_system, logger)
        .extract_payload_json_from_orchestrator_command_string(input)
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::path::{Path, PathBuf};

    use super::*;
    use crate::application::ports::{
        BackendLogEvent, BackendLoggerPort, FileSystemEntry, FileSystemPort,
    };

    #[derive(Default)]
    struct FakeFileSystem {
        files: HashMap<PathBuf, Vec<u8>>,
    }

    impl FakeFileSystem {
        fn with_file(mut self, path: &str, bytes: Vec<u8>) -> Self {
            self.files.insert(PathBuf::from(path), bytes);
            self
        }
    }

    impl FileSystemPort for FakeFileSystem {
        fn read_bytes(&self, path: &Path) -> BackendResult<Vec<u8>> {
            self.files
                .get(path)
                .cloned()
                .ok_or_else(|| BackendError::new("io_error", "file not found"))
        }

        fn read_dir(&self, _path: &Path) -> BackendResult<Vec<FileSystemEntry>> {
            Ok(vec![])
        }

        fn exists(&self, path: &Path) -> bool {
            self.files.contains_key(path)
        }

        fn is_file(&self, path: &Path) -> bool {
            self.files.contains_key(path)
        }

        fn is_dir(&self, _path: &Path) -> bool {
            false
        }
    }

    #[derive(Default)]
    struct NoopLogger;

    impl BackendLoggerPort for NoopLogger {
        fn log(&self, _event: &BackendLogEvent) -> BackendResult<()> {
            Ok(())
        }
    }

    #[test]
    fn reads_payload_json_file_as_utf8_text() {
        let fs = FakeFileSystem::default().with_file("/tmp/payload.json", br#"{"a":1}"#.to_vec());
        let logger = NoopLogger;
        let use_case = PayloadImportUseCase::new(&fs, &logger);

        let output = use_case
            .read_payload_json_file(ReadPayloadFileInput {
                path: "/tmp/payload.json".to_string(),
            })
            .expect("should read payload json");

        assert_eq!(output.payload_json, r#"{"a":1}"#);
    }

    #[test]
    fn extracts_payload_json_from_orchestrator_binary() {
        let payload = br#"{"game_name":"Age3"}"#;
        let injected = trailer::append_asset_bundle(
            b"ELF-MOCK",
            trailer::AssetBundleInput {
                config_json: payload,
                hero_image: None,
                icon_png: None,
            },
        );

        let fs = FakeFileSystem::default().with_file("/tmp/age3", injected);
        let logger = NoopLogger;
        let use_case = PayloadImportUseCase::new(&fs, &logger);

        let output = use_case
            .extract_payload_json_from_orchestrator(ReadPayloadFileInput {
                path: "/tmp/age3".to_string(),
            })
            .expect("should extract embedded payload");

        assert_eq!(output.payload_json, r#"{"game_name":"Age3"}"#);
    }
}
