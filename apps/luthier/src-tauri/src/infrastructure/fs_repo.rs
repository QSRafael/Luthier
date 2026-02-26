use std::collections::BTreeSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use luthier_orchestrator_core::GameConfig;

use crate::application::ports::{
    FileSystemEntry, FileSystemEntryKind, FileSystemPort,
};
use crate::domain::paths as domain_paths;
use crate::error::{BackendError, BackendResult};
use crate::models::dto::{
    ListChildDirectoriesInput, ListChildDirectoriesOutput, ListDirectoryEntriesInput,
    ListDirectoryEntriesOutput,
};

#[derive(Debug, Clone, Copy, Default)]
pub struct LocalFileSystemRepository;

impl LocalFileSystemRepository {
    pub fn new() -> Self {
        Self
    }
}

impl FileSystemPort for LocalFileSystemRepository {
    fn read_bytes(&self, path: &Path) -> BackendResult<Vec<u8>> {
        fs::read(path).map_err(BackendError::from)
    }

    fn write_bytes(&self, path: &Path, bytes: &[u8]) -> BackendResult<()> {
        fs::write(path, bytes).map_err(BackendError::from)
    }

    fn read_dir(&self, path: &Path) -> BackendResult<Vec<FileSystemEntry>> {
        let entries = fs::read_dir(path).map_err(BackendError::from)?;
        let mut out = Vec::new();

        for entry in entries {
            let entry = entry.map_err(BackendError::from)?;
            let kind = entry
                .file_type()
                .map(map_std_file_type)
                .map_err(BackendError::from)?;
            out.push(FileSystemEntry {
                path: entry.path(),
                kind,
            });
        }

        Ok(out)
    }

    fn exists(&self, path: &Path) -> bool {
        path.exists()
    }

    fn is_file(&self, path: &Path) -> bool {
        path.is_file()
    }

    fn is_dir(&self, path: &Path) -> bool {
        path.is_dir()
    }
}

pub(crate) fn read_bytes(path: &Path) -> BackendResult<Vec<u8>> {
    LocalFileSystemRepository::new().read_bytes(path)
}

pub(crate) fn list_child_directories(
    input: ListChildDirectoriesInput,
) -> BackendResult<ListChildDirectoriesOutput> {
    let root = PathBuf::from(&input.path);
    let entries = fs::read_dir(&root).map_err(|err| {
        BackendError::new("fs_read_dir_failed", format!("failed to list directory: {err}"))
    })?;

    let mut directories = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|err| {
            BackendError::new(
                "fs_read_dir_entry_failed",
                format!("failed to read directory entry: {err}"),
            )
        })?;
        let path = entry.path();
        if path.is_dir() {
            directories.push(path.to_string_lossy().into_owned());
        }
    }

    directories.sort_by_key(|value| value.to_ascii_lowercase());

    Ok(ListChildDirectoriesOutput {
        path: input.path,
        directories,
    })
}

pub(crate) fn list_directory_entries(
    input: ListDirectoryEntriesInput,
) -> BackendResult<ListDirectoryEntriesOutput> {
    let root = PathBuf::from(&input.path);
    let entries = fs::read_dir(&root).map_err(|err| {
        BackendError::new("fs_read_dir_failed", format!("failed to list directory: {err}"))
    })?;

    let mut directories = Vec::new();
    let mut files = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|err| {
            BackendError::new(
                "fs_read_dir_entry_failed",
                format!("failed to read directory entry: {err}"),
            )
        })?;
        let path = entry.path();
        if path.is_dir() {
            directories.push(path.to_string_lossy().into_owned());
        } else if path.is_file() {
            files.push(path.to_string_lossy().into_owned());
        }
    }

    directories.sort_by_key(|value| value.to_ascii_lowercase());
    files.sort_by_key(|value| value.to_ascii_lowercase());

    Ok(ListDirectoryEntriesOutput {
        path: input.path,
        directories,
        files,
    })
}

pub(crate) fn collect_missing_files(config: &GameConfig, game_root: &Path) -> BackendResult<Vec<String>> {
    let mut missing = Vec::new();

    let exe_path = domain_paths::resolve_relative_path(game_root, &config.relative_exe_path)?;
    if !exe_path.exists() {
        missing.push(config.relative_exe_path.clone());
    }

    for file in &config.integrity_files {
        let path = domain_paths::resolve_relative_path(game_root, file)?;
        if !path.exists() {
            missing.push(file.clone());
        }
    }

    Ok(missing)
}

pub(crate) fn resolve_base_orchestrator_binary(
    requested: &str,
    extra_hints: &[PathBuf],
) -> BackendResult<PathBuf> {
    let candidates = collect_base_orchestrator_binary_candidates(requested, extra_hints);
    let attempted_count = candidates.len();

    if let Some(found) = candidates.into_iter().find(|path| path.is_file()) {
        return Ok(found);
    }

    Err(BackendError::invalid_input(format!(
        "base Luthier Orchestrator binary not found. Tried {} candidate(s). Build the 'luthier-orchestrator' binary (debug/release) or package it as a Tauri resource.",
        attempted_count
    )))
}

pub(crate) fn collect_base_orchestrator_binary_candidates(
    requested: &str,
    extra_hints: &[PathBuf],
) -> Vec<PathBuf> {
    let mut candidates = Vec::<PathBuf>::new();
    let mut seen = BTreeSet::<String>::new();

    let mut push_candidate = |path: PathBuf| {
        let key = path.to_string_lossy().into_owned();
        if seen.insert(key) {
            candidates.push(path);
        }
    };

    if let Ok(path) = env::var("LUTHIER_BASE_ORCHESTRATOR") {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            push_candidate(PathBuf::from(trimmed));
        }
    }

    let requested_trimmed = requested.trim();
    if !requested_trimmed.is_empty() {
        push_candidate(PathBuf::from(requested_trimmed));
        if let Ok(cwd) = env::current_dir() {
            push_candidate(cwd.join(requested_trimmed));
        }
    }

    for hint in extra_hints {
        if !hint.as_os_str().is_empty() {
            push_candidate(hint.clone());
        }
    }

    let common_relative_candidates = [
        "target/debug/luthier-orchestrator",
        "target/release/luthier-orchestrator",
        "apps/luthier/src-tauri/resources/luthier-orchestrator-base/luthier-orchestrator",
        "src-tauri/resources/luthier-orchestrator-base/luthier-orchestrator",
        "resources/luthier-orchestrator-base/luthier-orchestrator",
        "luthier-orchestrator-base/luthier-orchestrator",
    ];

    if let Ok(cwd) = env::current_dir() {
        for ancestor in cwd.ancestors() {
            for rel in common_relative_candidates {
                push_candidate(ancestor.join(rel));
            }
        }
    }

    if let Ok(exe) = env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            for ancestor in exe_dir.ancestors() {
                for rel in common_relative_candidates {
                    push_candidate(ancestor.join(rel));
                }
            }
        }
    }

    candidates
}

pub(crate) fn find_executable_in_path(name: &str) -> Option<PathBuf> {
    let path_var = env::var_os("PATH")?;
    for directory in env::split_paths(&path_var) {
        let candidate = directory.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn map_std_file_type(file_type: fs::FileType) -> FileSystemEntryKind {
    if file_type.is_file() {
        FileSystemEntryKind::File
    } else if file_type.is_dir() {
        FileSystemEntryKind::Directory
    } else if file_type.is_symlink() {
        FileSystemEntryKind::Symlink
    } else {
        FileSystemEntryKind::Other
    }
}

