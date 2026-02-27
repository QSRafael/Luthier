use std::path::Path;

use crate::application::ports::{
    BackendLogEvent, BackendLogLevel, BackendLoggerPort, FileSystemPort,
};
use crate::error::{BackendError, BackendResult, BackendResultExt, CommandStringResult};
use crate::models::dto::{
    ListChildDirectoriesInput, ListChildDirectoriesOutput, ListDirectoryEntriesInput,
    ListDirectoryEntriesOutput,
};

pub struct ListFsUseCase<'a> {
    file_system: &'a dyn FileSystemPort,
    logger: &'a dyn BackendLoggerPort,
}

impl<'a> ListFsUseCase<'a> {
    pub fn new(file_system: &'a dyn FileSystemPort, logger: &'a dyn BackendLoggerPort) -> Self {
        Self {
            file_system,
            logger,
        }
    }

    pub fn list_child_directories(
        &self,
        input: ListChildDirectoriesInput,
    ) -> BackendResult<ListChildDirectoriesOutput> {
        self.log_info(
            "GO-CR-501",
            "list_child_directories_requested",
            serde_json::json!({ "path": &input.path }),
        );

        let root = Path::new(&input.path);
        let entries = self.file_system.read_dir(root).map_err(map_read_dir_error)?;
        let mut directories = Vec::new();

        for entry in entries {
            let path = entry.path;
            if self.file_system.is_dir(&path) {
                directories.push(path.to_string_lossy().into_owned());
            }
        }

        directories.sort_by_key(|value| value.to_ascii_lowercase());

        let out = ListChildDirectoriesOutput {
            path: input.path,
            directories,
        };

        self.log_info(
            "GO-CR-502",
            "list_child_directories_completed",
            serde_json::json!({
                "path": &out.path,
                "directories_count": out.directories.len(),
            }),
        );

        Ok(out)
    }

    pub fn list_directory_entries(
        &self,
        input: ListDirectoryEntriesInput,
    ) -> BackendResult<ListDirectoryEntriesOutput> {
        self.log_info(
            "GO-CR-503",
            "list_directory_entries_requested",
            serde_json::json!({ "path": &input.path }),
        );

        let root = Path::new(&input.path);
        let entries = self.file_system.read_dir(root).map_err(map_read_dir_error)?;
        let mut directories = Vec::new();
        let mut files = Vec::new();

        for entry in entries {
            let path = entry.path;
            if self.file_system.is_dir(&path) {
                directories.push(path.to_string_lossy().into_owned());
            } else if self.file_system.is_file(&path) {
                files.push(path.to_string_lossy().into_owned());
            }
        }

        directories.sort_by_key(|value| value.to_ascii_lowercase());
        files.sort_by_key(|value| value.to_ascii_lowercase());

        let out = ListDirectoryEntriesOutput {
            path: input.path,
            directories,
            files,
        };

        self.log_info(
            "GO-CR-504",
            "list_directory_entries_completed",
            serde_json::json!({
                "path": &out.path,
                "directories_count": out.directories.len(),
                "files_count": out.files.len(),
            }),
        );

        Ok(out)
    }

    pub fn list_child_directories_command_string(
        &self,
        input: ListChildDirectoriesInput,
    ) -> CommandStringResult<ListChildDirectoriesOutput> {
        self.list_child_directories(input)
            .into_command_string_result()
    }

    pub fn list_directory_entries_command_string(
        &self,
        input: ListDirectoryEntriesInput,
    ) -> CommandStringResult<ListDirectoryEntriesOutput> {
        self.list_directory_entries(input)
            .into_command_string_result()
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

fn map_read_dir_error(err: BackendError) -> BackendError {
    BackendError::new(
        "fs_read_dir_failed",
        format!("failed to list directory: {err}"),
    )
}

pub fn list_child_directories(
    input: ListChildDirectoriesInput,
    file_system: &dyn FileSystemPort,
    logger: &dyn BackendLoggerPort,
) -> BackendResult<ListChildDirectoriesOutput> {
    ListFsUseCase::new(file_system, logger).list_child_directories(input)
}

pub fn list_directory_entries(
    input: ListDirectoryEntriesInput,
    file_system: &dyn FileSystemPort,
    logger: &dyn BackendLoggerPort,
) -> BackendResult<ListDirectoryEntriesOutput> {
    ListFsUseCase::new(file_system, logger).list_directory_entries(input)
}

pub fn list_child_directories_command(
    input: ListChildDirectoriesInput,
    file_system: &dyn FileSystemPort,
    logger: &dyn BackendLoggerPort,
) -> CommandStringResult<ListChildDirectoriesOutput> {
    ListFsUseCase::new(file_system, logger).list_child_directories_command_string(input)
}

pub fn list_directory_entries_command(
    input: ListDirectoryEntriesInput,
    file_system: &dyn FileSystemPort,
    logger: &dyn BackendLoggerPort,
) -> CommandStringResult<ListDirectoryEntriesOutput> {
    ListFsUseCase::new(file_system, logger).list_directory_entries_command_string(input)
}
