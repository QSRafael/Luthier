use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};

use anyhow::{anyhow, Context};
use luthier_orchestrator_core::{FolderMount, GameConfig};
use serde::Serialize;

use super::paths::normalize_relative_payload_path;

#[derive(Debug, Serialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum MountStatus {
    Planned,
    Mounted,
    Unchanged,
}

#[derive(Debug, Serialize)]
pub struct MountExecutionResult {
    pub source_relative_path: String,
    pub target_windows_path: String,
    pub source_unix_path: String,
    pub target_unix_path: String,
    pub status: MountStatus,
    pub changed: bool,
    pub note: Option<String>,
}

pub fn apply_folder_mounts(
    config: &GameConfig,
    game_root: &Path,
    prefix_path: &Path,
    dry_run: bool,
) -> anyhow::Result<Vec<MountExecutionResult>> {
    if config.folder_mounts.is_empty() {
        return Ok(Vec::new());
    }

    let canonical_root = fs::canonicalize(game_root)
        .with_context(|| format!("failed to canonicalize game root {}", game_root.display()))?;

    let mut results = Vec::with_capacity(config.folder_mounts.len());
    let mut seen_targets = HashSet::<PathBuf>::new();

    for mount in &config.folder_mounts {
        let source_path = resolve_source_path(&canonical_root, mount, dry_run)?;
        let target_path = parse_target_windows_path(prefix_path, &mount.target_windows_path)?;

        if !seen_targets.insert(target_path.clone()) {
            return Err(anyhow!(
                "duplicate folder mount target detected: {}",
                mount.target_windows_path
            ));
        }

        let mut result = MountExecutionResult {
            source_relative_path: mount.source_relative_path.clone(),
            target_windows_path: mount.target_windows_path.clone(),
            source_unix_path: source_path.to_string_lossy().into_owned(),
            target_unix_path: target_path.to_string_lossy().into_owned(),
            status: MountStatus::Planned,
            changed: false,
            note: None,
        };

        if dry_run {
            result.status = MountStatus::Planned;
            result.note = Some("dry-run mode".to_string());
            results.push(result);
            continue;
        }

        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent).with_context(|| {
                format!("failed to create mount target parent {}", parent.display())
            })?;
        }

        if target_path.exists() {
            if is_symlink_pointing_to(&target_path, &source_path)? {
                result.status = MountStatus::Unchanged;
                result.changed = false;
                result.note = Some("already mounted".to_string());
                results.push(result);
                continue;
            }

            remove_existing_path(&target_path)?;
        }

        create_symlink(&source_path, &target_path)?;
        result.status = MountStatus::Mounted;
        result.changed = true;
        results.push(result);
    }

    Ok(results)
}

fn resolve_source_path(
    canonical_game_root: &Path,
    mount: &FolderMount,
    dry_run: bool,
) -> anyhow::Result<PathBuf> {
    let source_relative = normalize_relative_payload_path(&mount.source_relative_path)?;
    let source_path = canonical_game_root.join(&source_relative);

    if source_path.exists() {
        let metadata = fs::metadata(&source_path).with_context(|| {
            format!(
                "failed to read mount source metadata {}",
                source_path.display()
            )
        })?;

        if !metadata.is_dir() {
            return Err(anyhow!(
                "mount source is not a directory: {}",
                source_path.display()
            ));
        }

        let canonical_source = fs::canonicalize(&source_path).with_context(|| {
            format!(
                "failed to canonicalize mount source {}",
                source_path.display()
            )
        })?;
        ensure_path_inside_root(&canonical_source, canonical_game_root)?;
        return Ok(canonical_source);
    }

    if !mount.create_source_if_missing {
        return Err(anyhow!(
            "mount source is missing and auto-create is disabled: {}",
            source_path.display()
        ));
    }

    if dry_run {
        return Ok(source_path);
    }

    fs::create_dir_all(&source_path)
        .with_context(|| format!("failed to create mount source {}", source_path.display()))?;

    let canonical_source = fs::canonicalize(&source_path).with_context(|| {
        format!(
            "failed to canonicalize mount source {}",
            source_path.display()
        )
    })?;
    ensure_path_inside_root(&canonical_source, canonical_game_root)?;

    Ok(canonical_source)
}

fn ensure_path_inside_root(path: &Path, root: &Path) -> anyhow::Result<()> {
    if path.starts_with(root) {
        Ok(())
    } else {
        Err(anyhow!(
            "mount source escapes game root: source={}, root={}",
            path.display(),
            root.display()
        ))
    }
}

fn parse_target_windows_path(prefix_path: &Path, windows_path: &str) -> anyhow::Result<PathBuf> {
    let trimmed = windows_path.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("mount target path is empty"));
    }

    if trimmed.contains('%') {
        return Err(anyhow!(
            "mount target cannot contain environment expansion: {windows_path}"
        ));
    }

    if trimmed.starts_with("\\\\") || trimmed.starts_with("//") {
        return Err(anyhow!(
            "UNC mount targets are not supported: {windows_path}"
        ));
    }

    let normalized = trimmed.replace('/', "\\");
    let bytes = normalized.as_bytes();
    if bytes.len() < 2 || bytes[1] != b':' || !bytes[0].is_ascii_alphabetic() {
        return Err(anyhow!(
            "mount target must use drive letter format (e.g. C:\\foo): {windows_path}"
        ));
    }

    let drive = (bytes[0] as char).to_ascii_lowercase();
    let remainder = normalized[2..].trim_start_matches('\\').to_string();

    if remainder.is_empty() {
        return Err(anyhow!(
            "mount target must include subpath after drive root: {windows_path}"
        ));
    }

    let mut target = if drive == 'c' {
        prefix_path.join("drive_c")
    } else {
        prefix_path.join("dosdevices").join(format!("{drive}:"))
    };

    for segment in remainder.split('\\') {
        if segment.is_empty() || segment == "." {
            continue;
        }

        if segment == ".." {
            return Err(anyhow!(
                "mount target cannot contain path traversal: {windows_path}"
            ));
        }

        target.push(segment);
    }

    Ok(target)
}

fn is_symlink_pointing_to(target: &Path, source: &Path) -> anyhow::Result<bool> {
    let metadata = fs::symlink_metadata(target)
        .with_context(|| format!("failed to read metadata for {}", target.display()))?;

    if !metadata.file_type().is_symlink() {
        return Ok(false);
    }

    let link_target = fs::read_link(target)
        .with_context(|| format!("failed to read symlink target for {}", target.display()))?;

    let resolved_link_target = if link_target.is_absolute() {
        link_target
    } else {
        target
            .parent()
            .unwrap_or_else(|| Path::new("/"))
            .join(link_target)
    };

    let canonical_link = fs::canonicalize(&resolved_link_target).with_context(|| {
        format!(
            "failed to canonicalize link target {}",
            resolved_link_target.display()
        )
    })?;
    let canonical_source = fs::canonicalize(source)
        .with_context(|| format!("failed to canonicalize source {}", source.display()))?;

    Ok(canonical_link == canonical_source)
}

fn remove_existing_path(path: &Path) -> anyhow::Result<()> {
    let metadata = fs::symlink_metadata(path)
        .with_context(|| format!("failed to read metadata for {}", path.display()))?;

    if metadata.file_type().is_symlink() || metadata.is_file() {
        fs::remove_file(path)
            .with_context(|| format!("failed to remove file {}", path.display()))?;
        return Ok(());
    }

    if metadata.is_dir() {
        fs::remove_dir_all(path)
            .with_context(|| format!("failed to remove directory {}", path.display()))?;
        return Ok(());
    }

    Err(anyhow!(
        "unsupported path type for mount target {}",
        path.display()
    ))
}

#[cfg(unix)]
fn create_symlink(source: &Path, target: &Path) -> anyhow::Result<()> {
    std::os::unix::fs::symlink(source, target).with_context(|| {
        format!(
            "failed to create mount symlink from {} to {}",
            source.display(),
            target.display()
        )
    })
}

#[cfg(not(unix))]
fn create_symlink(_source: &Path, _target: &Path) -> anyhow::Result<()> {
    Err(anyhow!("folder mounts are only supported on unix hosts"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_windows_target_path_into_prefix_path() {
        let prefix = Path::new("/tmp/prefix");
        let target = parse_target_windows_path(prefix, "C:\\users\\steamuser\\Documents\\Game")
            .expect("parse target");

        assert_eq!(
            target,
            Path::new("/tmp/prefix/drive_c/users/steamuser/Documents/Game")
        );
    }

    #[test]
    fn rejects_unc_windows_target_path() {
        let prefix = Path::new("/tmp/prefix");
        let err =
            parse_target_windows_path(prefix, "\\\\server\\share").expect_err("must reject unc");

        assert!(err.to_string().contains("UNC"));
    }

    #[test]
    fn rejects_windows_target_without_drive_letter() {
        let prefix = Path::new("/tmp/prefix");
        let err = parse_target_windows_path(prefix, "users\\steamuser\\Documents")
            .expect_err("must reject missing drive");

        assert!(err.to_string().contains("drive letter"));
    }

    #[test]
    fn parses_non_c_drive_to_dosdevices() {
        let prefix = Path::new("/tmp/prefix");
        let target = parse_target_windows_path(prefix, "D:\\Games\\Saves").expect("parse target");

        assert_eq!(target, Path::new("/tmp/prefix/dosdevices/d:/Games/Saves"));
    }

    #[test]
    fn rejects_target_with_env_expansion() {
        let prefix = Path::new("/tmp/prefix");
        let err = parse_target_windows_path(prefix, "C:\\users\\%USERPROFILE%\\Documents")
            .expect_err("must reject env expansion");

        assert!(err.to_string().contains("environment expansion"));
    }

    #[test]
    fn rejects_target_with_path_traversal() {
        let prefix = Path::new("/tmp/prefix");
        let err = parse_target_windows_path(prefix, "C:\\users\\steamuser\\..\\Documents\\Game")
            .expect_err("must reject traversal");

        assert!(err.to_string().contains("path traversal"));
    }
}
