use std::io;
use std::path::PathBuf;

use anyhow::Context;
use clap::Parser;
use orchestrator_core::injector::{inject_from_files, InjectOptions};
use orchestrator_core::observability::{
    emit_ndjson, new_trace_id, LogEvent, LogIdentity, LogLevel,
};

#[derive(Debug, Parser)]
#[command(name = "orchestrator-injector")]
#[command(about = "Embeds GameConfig JSON into a base orchestrator binary")]
struct Cli {
    #[arg(long)]
    base: PathBuf,

    #[arg(long)]
    config: PathBuf,

    #[arg(long)]
    output: PathBuf,

    #[arg(long)]
    no_backup: bool,

    #[arg(long)]
    no_exec_bit: bool,
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let trace_id = new_trace_id();

    log_event(
        &trace_id,
        LogLevel::Info,
        "GO-CFG-010",
        "injector_started",
        serde_json::json!({
            "base": cli.base,
            "config": cli.config,
            "output": cli.output,
        }),
    );

    let options = InjectOptions {
        backup_existing: !cli.no_backup,
        make_executable: !cli.no_exec_bit,
    };

    let result = inject_from_files(&cli.base, &cli.config, &cli.output, options)
        .context("failed to inject config payload into binary")?;

    log_event(
        &trace_id,
        LogLevel::Info,
        "GO-CFG-011",
        "injector_finished",
        serde_json::json!({
            "output": result.output_path,
            "config_len": result.config_len,
            "config_sha256": result.config_sha256_hex,
        }),
    );

    println!("Output: {}", result.output_path.display());
    println!("Config bytes: {}", result.config_len);
    println!("Config SHA-256: {}", result.config_sha256_hex);

    Ok(())
}

fn log_event(
    trace_id: &str,
    level: LogLevel,
    code: &str,
    message: &str,
    context: serde_json::Value,
) {
    let event = LogEvent::new(
        level,
        code,
        message,
        LogIdentity::new(trace_id, "injector", "unknown", "creator"),
        context,
    );

    let mut stderr = io::stderr();
    let _ = emit_ndjson(&mut stderr, &event);
}
