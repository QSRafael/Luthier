use anyhow::Context;
use luthier_orchestrator_core::{
    doctor::{run_doctor, CheckStatus, DoctorReport},
    observability::LogLevel,
    prefix::build_prefix_setup_plan,
};

use crate::{logging::log_event, payload::try_load_embedded_config};

pub fn run_doctor_command(trace_id: &str, verbose: bool) -> anyhow::Result<()> {
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

    print_doctor_human_summary(&report, prefix_plan.as_ref());

    if verbose {
        let output = serde_json::json!({
            "doctor": report,
            "prefix_setup_plan": prefix_plan,
        });
        let pretty =
            serde_json::to_string_pretty(&output).context("failed to serialize doctor report")?;
        println!();
        println!("{pretty}");
    }

    Ok(())
}

fn print_doctor_human_summary(
    report: &DoctorReport,
    prefix_plan: Option<&luthier_orchestrator_core::prefix::PrefixSetupPlan>,
) {
    println!("Luthier Orchestrator Doctor");
    println!("---------------------------");
    println!(
        "{} Runtime: {}",
        status_icon(report.runtime.runtime_status),
        report.runtime.runtime_note
    );

    if let Some(selected) = report.runtime.selected_runtime {
        println!("  • Selecionado: {:?}", selected);
    }
    if let Some(proton) = &report.runtime.proton {
        println!("  • Proton: {proton}");
    }
    if let Some(umu) = &report.runtime.umu_run {
        println!("  • UMU: {umu}");
    }
    if let Some(wine) = &report.runtime.wine {
        println!("  • Wine: {wine}");
    }

    println!();
    println!("Dependencies");
    println!("------------");
    for dep in &report.dependencies {
        let state_label = dep
            .state
            .map(|state| format!(" [{state:?}]"))
            .unwrap_or_default();
        let path_label = dep
            .resolved_path
            .as_ref()
            .map(|path| format!(" ({path})"))
            .unwrap_or_default();

        println!(
            "{} {}{} - {}{}",
            status_icon(dep.status),
            dep.name,
            state_label,
            dep.note,
            path_label
        );
    }

    if let Some(plan) = prefix_plan {
        println!();
        println!("Prefix Setup");
        println!("----------");
        println!(
            "{} Prefix path: {}",
            if plan.needs_init { "!" } else { "✓" },
            plan.prefix_path
        );
        println!("• Commands planned: {}", plan.commands.len());
        if !plan.notes.is_empty() {
            for note in &plan.notes {
                println!("• {note}");
            }
        }
    }

    println!();
    println!("Summary: {}", status_label(report.summary));
}

fn status_icon(status: CheckStatus) -> &'static str {
    match status {
        CheckStatus::OK => "[✓]",
        CheckStatus::WARN => "[!]",
        CheckStatus::BLOCKER => "[✗]",
        CheckStatus::INFO => "[i]",
    }
}

fn status_label(status: CheckStatus) -> &'static str {
    match status {
        CheckStatus::OK => "OK",
        CheckStatus::WARN => "WARN",
        CheckStatus::BLOCKER => "BLOCKER",
        CheckStatus::INFO => "INFO",
    }
}
