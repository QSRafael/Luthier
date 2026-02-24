use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context};

pub fn resolve_game_root() -> anyhow::Result<PathBuf> {
    let current_exe = std::env::current_exe().context("failed to resolve current executable")?;
    let root = current_exe
        .parent()
        .ok_or_else(|| anyhow!("current executable has no parent directory"))?;
    Ok(root.to_path_buf())
}

pub fn resolve_relative_path(base: &Path, relative: &str) -> anyhow::Result<PathBuf> {
    let normalized = normalize_relative_payload_path(relative)?;
    Ok(base.join(normalized))
}

pub fn normalize_relative_payload_path(raw: &str) -> anyhow::Result<PathBuf> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("path is empty"));
    }

    let normalized = trimmed.replace('\\', "/");
    if normalized.starts_with('/') || has_windows_drive_prefix(&normalized) {
        return Err(anyhow!("absolute path is not allowed: {raw}"));
    }

    let mut out = PathBuf::new();
    for part in normalized.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }

        if part == ".." {
            return Err(anyhow!("path traversal is not allowed: {raw}"));
        }

        out.push(part);
    }

    if out.as_os_str().is_empty() {
        return Err(anyhow!("path resolves to empty value: {raw}"));
    }

    Ok(out)
}

fn has_windows_drive_prefix(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic()
}
