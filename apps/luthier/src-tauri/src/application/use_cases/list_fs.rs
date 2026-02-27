use crate::error::{BackendResult, BackendResultExt, CommandStringResult};
use crate::infrastructure::{fs_repo, logging::log_backend_event};
use crate::models::dto::{
    ListChildDirectoriesInput, ListChildDirectoriesOutput, ListDirectoryEntriesInput,
    ListDirectoryEntriesOutput,
};

#[derive(Debug, Clone, Copy, Default)]
pub struct ListFsUseCase;

impl ListFsUseCase {
    pub fn new() -> Self {
        Self
    }

    pub fn list_child_directories(
        &self,
        input: ListChildDirectoriesInput,
    ) -> BackendResult<ListChildDirectoriesOutput> {
        log_backend_event(
            "INFO",
            "GO-CR-501",
            "list_child_directories_requested",
            serde_json::json!({ "path": &input.path }),
        );

        let out = fs_repo::list_child_directories(input)?;

        log_backend_event(
            "INFO",
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
        log_backend_event(
            "INFO",
            "GO-CR-503",
            "list_directory_entries_requested",
            serde_json::json!({ "path": &input.path }),
        );

        let out = fs_repo::list_directory_entries(input)?;

        log_backend_event(
            "INFO",
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
}

pub fn list_child_directories(
    input: ListChildDirectoriesInput,
) -> BackendResult<ListChildDirectoriesOutput> {
    ListFsUseCase::new().list_child_directories(input)
}

pub fn list_directory_entries(
    input: ListDirectoryEntriesInput,
) -> BackendResult<ListDirectoryEntriesOutput> {
    ListFsUseCase::new().list_directory_entries(input)
}

pub fn list_child_directories_command(
    input: ListChildDirectoriesInput,
) -> CommandStringResult<ListChildDirectoriesOutput> {
    ListFsUseCase::new().list_child_directories_command_string(input)
}

pub fn list_directory_entries_command(
    input: ListDirectoryEntriesInput,
) -> CommandStringResult<ListDirectoryEntriesOutput> {
    ListFsUseCase::new().list_directory_entries_command_string(input)
}
