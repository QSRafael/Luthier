use std::path::{Component, Path};

use crate::LuthierError;

pub(crate) fn to_relative_inside_game_root(
    game_root: &Path,
    candidate: &Path,
) -> Result<String, LuthierError> {
    let relative = if candidate.is_absolute() {
        candidate
            .strip_prefix(game_root)
            .map_err(|_| LuthierError::PathOutsideGameRoot(candidate.to_string_lossy().into_owned()))?
            .to_path_buf()
    } else {
        candidate.to_path_buf()
    };

    let raw = path_to_unix_like(&relative);
    normalize_relative_payload_path(&raw)
}

pub(crate) fn normalize_relative_payload_path(raw: &str) -> Result<String, LuthierError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(LuthierError::InvalidRelativePath(raw.to_string()));
    }

    let normalized = trimmed.replace('\\', "/");
    if normalized.starts_with('/') || has_windows_drive_prefix(&normalized) {
        return Err(LuthierError::AbsolutePathNotAllowed(raw.to_string()));
    }

    let mut out = Vec::new();
    for part in normalized.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }

        if part == ".." {
            return Err(LuthierError::PathTraversalNotAllowed(raw.to_string()));
        }

        out.push(part);
    }

    if out.is_empty() {
        return Err(LuthierError::InvalidRelativePath(raw.to_string()));
    }

    Ok(out.join("/"))
}

pub(crate) fn path_to_unix_like(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::CurDir => None,
            Component::Normal(value) => Some(value.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<String>>()
        .join("/")
}

pub(crate) fn has_windows_drive_prefix(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic()
}

pub(crate) fn normalize_windows_mount_target(raw: &str) -> Result<String, LuthierError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(LuthierError::InvalidFolderMountTarget(raw.to_string()));
    }

    if trimmed.contains('%') {
        return Err(LuthierError::InvalidFolderMountTarget(raw.to_string()));
    }

    if trimmed.starts_with("\\\\") || trimmed.starts_with("//") {
        return Err(LuthierError::InvalidFolderMountTarget(raw.to_string()));
    }

    let normalized = trimmed.replace('/', "\\");
    let bytes = normalized.as_bytes();
    if bytes.len() < 2 || bytes[1] != b':' || !bytes[0].is_ascii_alphabetic() {
        return Err(LuthierError::InvalidFolderMountTarget(raw.to_string()));
    }

    let drive = (bytes[0] as char).to_ascii_uppercase();
    let remainder = normalized[2..].trim_start_matches('\\');
    if remainder.is_empty() {
        return Err(LuthierError::InvalidFolderMountTarget(raw.to_string()));
    }

    let mut segments = Vec::new();
    for segment in remainder.split('\\') {
        if segment.is_empty() || segment == "." {
            continue;
        }

        if segment == ".." {
            return Err(LuthierError::InvalidFolderMountTarget(raw.to_string()));
        }

        segments.push(segment);
    }

    if segments.is_empty() {
        return Err(LuthierError::InvalidFolderMountTarget(raw.to_string()));
    }

    Ok(format!(r"{drive}:\{}", segments.join("\\")))
}
