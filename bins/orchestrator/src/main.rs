use std::{fs, io};

use anyhow::Context;
use clap::Parser;
use orchestrator_core::{
    observability::{emit_ndjson, new_trace_id, LogEvent, LogLevel},
    trailer::extract_config_json,
    GameConfig,
};

#[derive(Debug, Parser)]
#[command(name = "orchestrator")]
#[command(about = "Game Orchestrator CLI")]
struct Cli {
    #[arg(long)]
    play: bool,

    #[arg(long)]
    config: bool,

    #[arg(long)]
    doctor: bool,

    #[arg(long)]
    verbose: bool,

    #[arg(long)]
    show_config: bool,

    #[arg(long)]
    lang: Option<String>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let trace_id = new_trace_id();

    log_info(
        &trace_id,
        "startup",
        "GO-UI-001",
        "orchestrator_started",
        serde_json::json!({
            "play": cli.play,
            "config": cli.config,
            "doctor": cli.doctor,
            "show_config": cli.show_config,
            "lang": cli.lang,
        }),
    );

    if cli.show_config {
        show_embedded_config(&trace_id)
            .context("failed to print embedded config from current executable")?;
        return Ok(());
    }

    if cli.doctor {
        log_info(
            &trace_id,
            "doctor",
            "GO-DR-001",
            "doctor_requested_but_not_implemented",
            serde_json::json!({}),
        );
        println!("--doctor ainda nao implementado.");
        return Ok(());
    }

    if cli.config {
        log_info(
            &trace_id,
            "config",
            "GO-UI-002",
            "config_ui_requested_but_not_implemented",
            serde_json::json!({}),
        );
        println!("--config ainda nao implementado.");
        return Ok(());
    }

    if cli.play {
        log_info(
            &trace_id,
            "launcher",
            "GO-LN-001",
            "play_requested_but_not_implemented",
            serde_json::json!({}),
        );
        println!("--play ainda nao implementado.");
        return Ok(());
    }

    println!("Nada para executar. Use --show-config, --doctor, --config ou --play.");
    Ok(())
}

fn show_embedded_config(trace_id: &str) -> anyhow::Result<()> {
    let current_exe = std::env::current_exe().context("failed to resolve current executable")?;
    let binary = fs::read(&current_exe)
        .with_context(|| format!("failed to read executable at {}", current_exe.display()))?;

    let json_bytes = extract_config_json(&binary).context("embedded payload trailer not found")?;
    let parsed: GameConfig =
        serde_json::from_slice(json_bytes).context("invalid embedded GameConfig")?;

    log_info(
        trace_id,
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

fn log_info(trace_id: &str, span_id: &str, code: &str, message: &str, context: serde_json::Value) {
    let event = LogEvent::new(
        LogLevel::Info,
        code,
        message,
        trace_id,
        span_id,
        "unknown",
        "orchestrator",
        context,
    );

    let mut stderr = io::stderr();
    let _ = emit_ndjson(&mut stderr, &event);
}
