use std::path::{Component, Path};

use crate::LuthierError;

pub(crate) fn to_relative_inside_game_root(
    game_root: &Path,
    candidate: &Path,
) -> Result<String, LuthierError> {
    let relative = if candidate.is_absolute() {
        candidate
            .strip_prefix(game_root)
            .map_err(|_| {
                LuthierError::PathOutsideGameRoot(candidate.to_string_lossy().into_owned())
            })?
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

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{
        normalize_relative_payload_path, normalize_windows_mount_target, path_to_unix_like,
        to_relative_inside_game_root,
    };
    use crate::LuthierError;

    #[test]
    fn normalize_relative_payload_path_normalizes_mixed_separators_and_curdir_segments() {
        let normalized = normalize_relative_payload_path(r" ./assets\.\bin//game.exe ")
            .expect("path with mixed separators and '.' must normalize");

        assert_eq!(normalized, "assets/bin/game.exe");
    }

    #[test]
    fn normalize_relative_payload_path_is_idempotent_after_normalization() {
        let once = normalize_relative_payload_path(r" .\mods//bin\game.exe ")
            .expect("must normalize on first pass");
        let twice = normalize_relative_payload_path(&once)
            .expect("already-normalized path must stay valid");

        assert_eq!(once, "mods/bin/game.exe");
        assert_eq!(twice, once);
    }

    #[test]
    fn normalize_relative_payload_path_rejects_path_traversal_with_consistent_error_message() {
        for raw in [
            r"../secret.dll",
            r"mods/../secret.dll",
            r".\mods\..\secret.dll",
        ] {
            let err = normalize_relative_payload_path(raw).expect_err("traversal must be rejected");

            assert!(matches!(
                &err,
                LuthierError::PathTraversalNotAllowed(value) if value == raw
            ));
            assert_eq!(
                err.to_string(),
                format!("path traversal not allowed in game payload: {raw}")
            );
        }
    }

    #[test]
    fn normalize_relative_payload_path_rejects_linux_and_windows_absolute_paths() {
        for raw in [
            "/opt/game/game.exe",
            r"C:\Games\Demo\game.exe",
            "d:/games/demo.exe",
            "////",
        ] {
            let err = normalize_relative_payload_path(raw)
                .expect_err("absolute path must not be accepted as relative payload path");

            assert!(matches!(
                &err,
                LuthierError::AbsolutePathNotAllowed(value) if value == raw
            ));
            assert_eq!(
                err.to_string(),
                format!("absolute path not allowed in game payload: {raw}")
            );
        }
    }

    #[test]
    fn normalize_relative_payload_path_rejects_empty_or_dot_only_input() {
        for raw in ["", "   ", ".", "./", ".\\", ".//./"] {
            let err = normalize_relative_payload_path(raw).expect_err("invalid relative path");
            assert!(matches!(
                &err,
                LuthierError::InvalidRelativePath(value) if value == raw
            ));
            assert_eq!(
                err.to_string(),
                format!("invalid relative path in game payload: {raw}")
            );
        }
    }

    #[test]
    fn to_relative_inside_game_root_normalizes_absolute_inside_root() {
        let root = Path::new("/games/sample");
        let candidate = Path::new("/games/sample/./bin\\game.exe");

        let relative =
            to_relative_inside_game_root(root, candidate).expect("candidate is inside game root");

        assert_eq!(relative, "bin/game.exe");
    }

    #[test]
    fn to_relative_inside_game_root_rejects_absolute_path_outside_root_with_coherent_message() {
        let root = Path::new("/games/sample");
        let outside = Path::new("/games/another/game.exe");
        let outside_raw = outside.to_string_lossy().into_owned();

        let err = to_relative_inside_game_root(root, outside)
            .expect_err("absolute path outside game root must be rejected");

        assert!(matches!(
            &err,
            LuthierError::PathOutsideGameRoot(value) if value == &outside_raw
        ));
        assert_eq!(
            err.to_string(),
            format!("path is outside game root: {outside_raw}")
        );
    }

    #[test]
    fn path_to_unix_like_skips_curdir_and_preserves_normal_components() {
        let converted = path_to_unix_like(Path::new("./mods/./bin/game.exe"));
        assert_eq!(converted, "mods/bin/game.exe");
    }

    #[test]
    fn normalize_windows_mount_target_normalizes_separators_and_drive_letter_case() {
        let normalized = normalize_windows_mount_target("c:/Users/steamuser/Documents/MyGame")
            .expect("valid target must normalize");

        assert_eq!(normalized, r"C:\Users\steamuser\Documents\MyGame");
    }
}
