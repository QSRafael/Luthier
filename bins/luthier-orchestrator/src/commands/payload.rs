use std::{fs, path::PathBuf};

use anyhow::{anyhow, Context};

use crate::infrastructure::payload_loader::load_embedded_config_required;

const HERO_IMAGE_MASKED_HINT: &str = "base-64 image. Use --show-base64-hero-image to see";

pub fn run_show_payload_command(
    _trace_id: &str,
    include_hero_image_base64: bool,
) -> anyhow::Result<()> {
    let parsed = load_embedded_config_required()?;
    let mut payload = parsed.clone();

    if !include_hero_image_base64 && !payload.splash.hero_image_data_url.trim().is_empty() {
        payload.splash.hero_image_data_url = HERO_IMAGE_MASKED_HINT.to_string();
    }

    let pretty = serde_json::to_string_pretty(&payload).context("failed to format payload")?;
    println!("{pretty}");

    Ok(())
}

pub fn run_save_payload_command(_trace_id: &str) -> anyhow::Result<()> {
    let parsed = load_embedded_config_required()?;
    let game_root = current_game_root()?;
    let output_path = game_root.join("luthier-payload.json");

    let payload_bytes =
        serde_json::to_vec_pretty(&parsed).context("failed to serialize payload for save")?;
    fs::write(&output_path, payload_bytes)
        .with_context(|| format!("failed to write payload file at {}", output_path.display()))?;

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
