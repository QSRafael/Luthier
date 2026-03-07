use std::fs;

use anyhow::{anyhow, Context};
use luthier_orchestrator_core::{
    trailer::{extract_asset_bundle, AssetType, PayloadAssets},
    GameConfig, OrchestratorError,
};

pub fn load_embedded_config_required() -> anyhow::Result<GameConfig> {
    let config = try_load_embedded_config()?;
    config.ok_or_else(|| anyhow!("embedded payload trailer not found"))
}

pub fn try_load_embedded_config() -> anyhow::Result<Option<GameConfig>> {
    Ok(try_load_embedded_assets()?.map(|assets| {
        serde_json::from_slice::<GameConfig>(&assets.config_json).expect("validated during parse")
    }))
}

pub fn try_load_embedded_assets() -> anyhow::Result<Option<PayloadAssets>> {
    let current_exe = std::env::current_exe().context("failed to resolve current executable")?;
    let binary = fs::read(&current_exe)
        .with_context(|| format!("failed to read executable at {}", current_exe.display()))?;

    let assets = match extract_asset_bundle(&binary) {
        Ok(bundle) => bundle,
        Err(OrchestratorError::TrailerNotFound | OrchestratorError::TrailerTruncated) => {
            return Ok(None);
        }
        Err(err) => return Err(anyhow!(err)),
    };

    let parsed: GameConfig =
        serde_json::from_slice(&assets.config_json).context("invalid embedded GameConfig")?;
    let mut bundle = assets;
    bundle.config_json = serde_json::to_vec(&parsed).context("failed to normalize config")?;

    Ok(Some(bundle))
}

pub fn asset_type_name(asset_type: AssetType) -> &'static str {
    match asset_type {
        AssetType::ConfigJson => "config_json",
        AssetType::HeroImage => "hero_image",
        AssetType::IconPng => "icon_png",
    }
}
