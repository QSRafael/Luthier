use std::path::Path;

use anyhow::Context;
use luthier_orchestrator_core::GameConfig;

use crate::paths::resolve_relative_path;

pub fn validate_integrity(config: &GameConfig, game_root: &Path) -> anyhow::Result<Vec<String>> {
    validate_required_paths(game_root, &config.relative_exe_path, &config.integrity_files)
}

pub fn validate_required_paths(
    game_root: &Path,
    relative_exe_path: &str,
    integrity_files: &[String],
) -> anyhow::Result<Vec<String>> {
    let mut missing = Vec::new();

    let exe_path = resolve_relative_path(game_root, relative_exe_path)
        .with_context(|| format!("invalid relative_exe_path '{}'", relative_exe_path))?;
    if !exe_path.exists() {
        missing.push(relative_exe_path.to_string());
    }

    for file in integrity_files {
        let path =
            resolve_relative_path(game_root, file).with_context(|| format!("invalid path '{file}'"))?;
        if !path.exists() {
            missing.push(file.clone());
        }
    }

    Ok(missing)
}
