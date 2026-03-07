use std::{fs, path::PathBuf};

use anyhow::{anyhow, Context};
use luthier_orchestrator_core::trailer::AssetType;

use crate::infrastructure::payload_loader::{asset_type_name, try_load_embedded_assets};

pub fn run_show_manifest_command(_trace_id: &str) -> anyhow::Result<()> {
    let assets =
        try_load_embedded_assets()?.ok_or_else(|| anyhow!("embedded payload trailer not found"))?;

    let entries = assets
        .manifest
        .entries
        .iter()
        .map(|entry| {
            serde_json::json!({
                "type": asset_type_name(entry.asset_type),
                "offset": entry.offset,
                "len": entry.len,
                "sha256": to_lower_hex(&entry.sha256),
            })
        })
        .collect::<Vec<_>>();

    println!("{}", serde_json::to_string_pretty(&entries)?);
    Ok(())
}

pub fn run_extract_config_command(_trace_id: &str, out: Option<&str>) -> anyhow::Result<()> {
    extract_asset(AssetType::ConfigJson, out)
}

pub fn run_extract_hero_image_command(_trace_id: &str, out: Option<&str>) -> anyhow::Result<()> {
    extract_asset(AssetType::HeroImage, out)
}

pub fn run_extract_icon_command(_trace_id: &str, out: Option<&str>) -> anyhow::Result<()> {
    extract_asset(AssetType::IconPng, out)
}

fn extract_asset(asset_type: AssetType, out: Option<&str>) -> anyhow::Result<()> {
    let assets =
        try_load_embedded_assets()?.ok_or_else(|| anyhow!("embedded payload trailer not found"))?;

    let bytes = match asset_type {
        AssetType::ConfigJson => Some(assets.config_json),
        AssetType::HeroImage => assets.hero_image,
        AssetType::IconPng => assets.icon_png,
    }
    .ok_or_else(|| anyhow!("asset not found: {}", asset_type_name(asset_type)))?;

    let output = resolve_output_path(asset_type, out)?;
    fs::write(&output, bytes)
        .with_context(|| format!("failed to write extracted asset at {}", output.display()))?;
    println!("{}", output.display());
    Ok(())
}

fn resolve_output_path(asset_type: AssetType, out: Option<&str>) -> anyhow::Result<PathBuf> {
    if let Some(value) = out {
        return Ok(PathBuf::from(value));
    }

    let game_root = current_game_root()?;
    let file_name = match asset_type {
        AssetType::ConfigJson => "payload-config.json",
        AssetType::HeroImage => "payload-hero-image.bin",
        AssetType::IconPng => "payload-icon.png",
    };
    Ok(game_root.join(file_name))
}

fn current_game_root() -> anyhow::Result<PathBuf> {
    let exe_path = std::env::current_exe().context("failed to resolve current executable path")?;
    let parent = exe_path.parent().ok_or_else(|| {
        anyhow!(
            "failed to resolve game root from current executable: {}",
            exe_path.display()
        )
    })?;
    Ok(parent.to_path_buf())
}

fn to_lower_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(HEX[(b >> 4) as usize] as char);
        out.push(HEX[(b & 0x0f) as usize] as char);
    }
    out
}
