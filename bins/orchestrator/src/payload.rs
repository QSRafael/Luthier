use std::fs;

use anyhow::{anyhow, Context};
use orchestrator_core::{trailer::extract_config_json, GameConfig, OrchestratorError};

pub fn load_embedded_config_required() -> anyhow::Result<GameConfig> {
    let config = try_load_embedded_config()?;
    config.ok_or_else(|| anyhow!("embedded payload trailer not found"))
}

pub fn try_load_embedded_config() -> anyhow::Result<Option<GameConfig>> {
    let current_exe = std::env::current_exe().context("failed to resolve current executable")?;
    let binary = fs::read(&current_exe)
        .with_context(|| format!("failed to read executable at {}", current_exe.display()))?;

    let json_bytes = match extract_config_json(&binary) {
        Ok(bytes) => bytes,
        Err(OrchestratorError::TrailerNotFound | OrchestratorError::TrailerTruncated) => {
            return Ok(None);
        }
        Err(err) => return Err(anyhow!(err)),
    };

    let parsed: GameConfig =
        serde_json::from_slice(json_bytes).context("invalid embedded GameConfig")?;

    Ok(Some(parsed))
}
