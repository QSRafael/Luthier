use anyhow::Context;
use luthier_orchestrator_core::observability::LogLevel;

use crate::{logging::log_event, payload::load_embedded_config_required};

pub fn run_show_embedded_config(trace_id: &str) -> anyhow::Result<()> {
    let parsed = load_embedded_config_required()?;

    log_event(
        trace_id,
        LogLevel::Info,
        "config",
        "GO-CFG-001",
        "embedded_config_loaded",
        serde_json::json!({
            "game_name": parsed.game_name,
            "exe_hash": parsed.exe_hash,
            "config_version": parsed.config_version,
        }),
    );

    let pretty = serde_json::to_string_pretty(&parsed).context("failed to format config")?;
    println!("{pretty}");

    Ok(())
}
