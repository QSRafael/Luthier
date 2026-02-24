use anyhow::Context;
use orchestrator_core::{
    doctor::run_doctor, observability::LogLevel, prefix::build_prefix_setup_plan,
};

use crate::{logging::log_event, payload::try_load_embedded_config};

pub fn run_doctor_command(trace_id: &str) -> anyhow::Result<()> {
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
