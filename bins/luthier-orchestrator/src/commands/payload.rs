use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context};

use crate::infrastructure::payload_loader::load_embedded_payload_required;

pub fn run_show_manifest_command(_trace_id: &str) -> anyhow::Result<()> {
    let payload = load_embedded_payload_required()?;
    let pretty =
        serde_json::to_string_pretty(&payload.manifest).context("failed to format manifest")?;
    println!("{pretty}");
    Ok(())
}

pub fn run_extract_config_command(_trace_id: &str, out: Option<&Path>) -> anyhow::Result<()> {
    let payload = load_embedded_payload_required()?;

    if let Some(out_path) = out {
        fs::write(out_path, payload.config_json)
            .with_context(|| format!("failed to write config asset to {}", out_path.display()))?;
        println!("{}", out_path.display());
        return Ok(());
    }

    let text = std::str::from_utf8(&payload.config_json)
        .context("embedded config_json asset is not valid UTF-8")?;
    println!("{text}");
    Ok(())
}

pub fn run_extract_hero_image_command(_trace_id: &str, out: Option<&Path>) -> anyhow::Result<()> {
    let payload = load_embedded_payload_required()?;
    let hero = payload
        .hero_image
        .ok_or_else(|| anyhow!("embedded hero_image asset not found"))?;

    let output_path = if let Some(path) = out {
        path.to_path_buf()
    } else {
        let game_root = current_game_root()?;
        let extension = detect_image_extension(&hero).unwrap_or("bin");
        game_root.join(format!(
            "{}-hero-image.{extension}",
            executable_name_for_default_output()?
        ))
    };

    fs::write(&output_path, hero).with_context(|| {
        format!(
            "failed to write hero image asset to {}",
            output_path.display()
        )
    })?;
    println!("{}", output_path.display());
    Ok(())
}

pub fn run_extract_icon_command(_trace_id: &str, out: Option<&Path>) -> anyhow::Result<()> {
    let payload = load_embedded_payload_required()?;
    let icon = payload
        .icon_png
        .ok_or_else(|| anyhow!("embedded icon_png asset not found"))?;

    let output_path = if let Some(path) = out {
        path.to_path_buf()
    } else {
        let game_root = current_game_root()?;
        game_root.join(format!(
            "{}-icon.png",
            executable_name_for_default_output()?
        ))
    };

    fs::write(&output_path, icon)
        .with_context(|| format!("failed to write icon asset to {}", output_path.display()))?;
    println!("{}", output_path.display());
    Ok(())
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

fn executable_name_for_default_output() -> anyhow::Result<String> {
    let exe_path = std::env::current_exe().context("failed to resolve current executable path")?;
    let executable_name = exe_path
        .file_stem()
        .or_else(|| exe_path.file_name())
        .and_then(|value| value.to_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| anyhow!("failed to resolve executable name for output file"))?;

    Ok(executable_name.to_string())
}

fn detect_image_extension(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Some("png");
    }
    if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        return Some("jpg");
    }
    if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return Some("webp");
    }
    None
}
