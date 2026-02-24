use std::{fs, io, path::Path};

use anyhow::{anyhow, Context};
use clap::Parser;
use orchestrator_core::{
    doctor::{run_doctor, CheckStatus},
    observability::{emit_ndjson, new_trace_id, LogEvent, LogLevel},
    prefix::{base_env_for_prefix, build_prefix_setup_plan},
    process::{execute_prefix_setup_plan, has_mandatory_failures},
    trailer::extract_config_json,
    GameConfig, OrchestratorError,
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

    log_event(
        &trace_id,
        LogLevel::Info,
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
        run_doctor_command(&trace_id).context("doctor command failed")?;
        return Ok(());
    }

    if cli.config {
        log_event(
            &trace_id,
            LogLevel::Info,
            "config",
            "GO-UI-002",
            "config_ui_requested_but_not_implemented",
            serde_json::json!({}),
        );
        println!("--config ainda nao implementado.");
        return Ok(());
    }

    if cli.play {
        run_play_preflight(&trace_id).context("play preflight failed")?;
        return Ok(());
    }

    println!("Nada para executar. Use --show-config, --doctor, --config ou --play.");
    Ok(())
}

fn show_embedded_config(trace_id: &str) -> anyhow::Result<()> {
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

fn run_doctor_command(trace_id: &str) -> anyhow::Result<()> {
    let embedded_config =
        try_load_embedded_config().context("failed to inspect embedded config")?;
    let prefix_plan = embedded_config
        .as_ref()
        .map(build_prefix_setup_plan)
        .transpose()
        .context("failed to build prefix setup plan")?;

    if embedded_config.is_none() {
        log_event(
            trace_id,
            LogLevel::Warn,
            "doctor",
            "GO-DR-002",
            "doctor_running_without_embedded_config",
            serde_json::json!({}),
        );
    }

    let report = run_doctor(embedded_config.as_ref());

    log_event(
        trace_id,
        LogLevel::Info,
        "doctor",
        "GO-DR-003",
        "doctor_finished",
        serde_json::json!({
            "summary": report.summary,
            "has_embedded_config": report.has_embedded_config,
        }),
    );

    let output = serde_json::json!({
        "doctor": report,
        "prefix_setup_plan": prefix_plan,
    });
    let pretty =
        serde_json::to_string_pretty(&output).context("failed to serialize doctor report")?;
    println!("{pretty}");

    Ok(())
}

fn run_play_preflight(trace_id: &str) -> anyhow::Result<()> {
    let config = load_embedded_config_required()?;
    let report = run_doctor(Some(&config));

    log_event(
        trace_id,
        LogLevel::Info,
        "launcher",
        "GO-LN-010",
        "play_preflight_doctor_finished",
        serde_json::json!({
            "summary": report.summary,
        }),
    );

    if matches!(report.summary, CheckStatus::BLOCKER) {
        let pretty =
            serde_json::to_string_pretty(&report).context("failed to serialize blocker report")?;
        println!("{pretty}");
        return Err(anyhow!(
            "doctor returned BLOCKER; launch aborted before prefix/setup"
        ));
    }

    let prefix_plan = build_prefix_setup_plan(&config).context("failed to build prefix plan")?;
    let prefix_env = base_env_for_prefix(Path::new(&prefix_plan.prefix_path));
    let dry_run = std::env::var("GAME_ORCH_DRY_RUN")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let setup_results = execute_prefix_setup_plan(&prefix_plan, &prefix_env, dry_run);

    log_event(
        trace_id,
        LogLevel::Info,
        "launcher",
        "GO-LN-011",
        "play_preflight_prefix_plan_ready",
        serde_json::json!({
            "needs_init": prefix_plan.needs_init,
            "commands": prefix_plan.commands.len(),
            "dry_run": dry_run,
            "setup_steps": setup_results.len(),
        }),
    );

    if has_mandatory_failures(&setup_results) {
        let output = serde_json::json!({
            "doctor": report,
            "prefix_setup_plan": prefix_plan,
            "prefix_setup_execution": setup_results,
            "launch": {
                "status": "aborted",
                "reason": "mandatory prefix setup command failed"
            }
        });
        println!(
            "{}",
            serde_json::to_string_pretty(&output)
                .context("failed to serialize preflight output")?
        );

        return Err(anyhow!(
            "mandatory prefix setup step failed; launch aborted"
        ));
    }

    let output = serde_json::json!({
        "doctor": report,
        "prefix_setup_plan": prefix_plan,
        "prefix_setup_execution": setup_results,
        "launch": {
            "status": "pending",
            "note": "game launch wiring is not implemented yet"
        }
    });
    println!(
        "{}",
        serde_json::to_string_pretty(&output).context("failed to serialize preflight output")?
    );

    Ok(())
}

fn load_embedded_config_required() -> anyhow::Result<GameConfig> {
    let config = try_load_embedded_config()?;
    config.ok_or_else(|| anyhow!("embedded payload trailer not found"))
}

fn try_load_embedded_config() -> anyhow::Result<Option<GameConfig>> {
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

fn log_event(
    trace_id: &str,
    level: LogLevel,
    span_id: &str,
    code: &str,
    message: &str,
    context: serde_json::Value,
) {
    let event = LogEvent::new(
        level,
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
