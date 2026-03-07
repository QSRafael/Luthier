use std::fs;

use anyhow::{anyhow, Context};
use luthier_orchestrator_core::asset_container::{parse_asset_container, AssetManifest};
use luthier_orchestrator_core::{GameConfig, OrchestratorError};

#[derive(Debug, Clone)]
pub struct EmbeddedPayloadAssets {
    pub manifest: AssetManifest,
    pub config_json: Vec<u8>,
    pub config: GameConfig,
    pub hero_image: Option<Vec<u8>>,
    pub icon_png: Option<Vec<u8>>,
}

pub fn load_embedded_payload_required() -> anyhow::Result<EmbeddedPayloadAssets> {
    let payload = try_load_embedded_payload()?;
    payload.ok_or_else(|| anyhow!("embedded asset container not found"))
}

pub fn try_load_embedded_payload() -> anyhow::Result<Option<EmbeddedPayloadAssets>> {
    let current_exe = std::env::current_exe().context("failed to resolve current executable")?;
    let binary = fs::read(&current_exe)
        .with_context(|| format!("failed to read executable at {}", current_exe.display()))?;

    let parsed = match parse_asset_container(&binary) {
        Ok(parsed) => parsed,
        Err(OrchestratorError::ContainerNotFound | OrchestratorError::ContainerTruncated) => {
            return Ok(None);
        }
        Err(err) => return Err(anyhow!(err)),
    };

    let config_json = parsed.config_json().to_vec();
    let config: GameConfig =
        serde_json::from_slice(&config_json).context("invalid embedded GameConfig")?;

    Ok(Some(EmbeddedPayloadAssets {
        manifest: parsed.manifest.clone(),
        config_json,
        config,
        hero_image: parsed.hero_image().map(ToOwned::to_owned),
        icon_png: parsed.icon_png().map(ToOwned::to_owned),
    }))
}

pub fn load_embedded_config_required() -> anyhow::Result<GameConfig> {
    Ok(load_embedded_payload_required()?.config)
}

pub fn try_load_embedded_config() -> anyhow::Result<Option<GameConfig>> {
    Ok(try_load_embedded_payload()?.map(|payload| payload.config))
}
