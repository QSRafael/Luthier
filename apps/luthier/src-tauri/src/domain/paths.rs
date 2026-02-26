use std::path::{Path, PathBuf};

use crate::error::{BackendError, BackendResult};

pub(crate) fn resolve_relative_path(base: &Path, relative: &str) -> BackendResult<PathBuf> {
    let normalized = normalize_relative_payload_path(relative)?;
    Ok(base.join(normalized))
}

pub(crate) fn normalize_relative_payload_path(raw: &str) -> BackendResult<PathBuf> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(BackendError::invalid_input("path is empty").with_code("path_empty"));
    }

    let normalized = trimmed.replace('\\', "/");
    if normalized.starts_with('/') || has_windows_drive_prefix(&normalized) {
        return Err(
            BackendError::invalid_input(format!("absolute path is not allowed: {raw}"))
                .with_code("absolute_path_not_allowed"),
        );
    }

    let mut out = PathBuf::new();
    for part in normalized.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }

        if part == ".." {
            return Err(BackendError::invalid_input(format!(
                "path traversal is not allowed: {raw}"
            ))
            .with_code("path_traversal_not_allowed"));
        }

        out.push(part);
    }

    if out.as_os_str().is_empty() {
        return Err(
            BackendError::invalid_input(format!("path resolves to empty value: {raw}"))
                .with_code("path_empty_after_normalization"),
        );
    }

    Ok(out)
}

pub(crate) fn has_windows_drive_prefix(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic()
}
