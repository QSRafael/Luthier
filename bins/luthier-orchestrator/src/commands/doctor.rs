use anyhow::Context;
use luthier_orchestrator_core::doctor::{CheckStatus, DoctorReport};

use crate::application::doctor_flow::execute_doctor_flow;

pub fn run_doctor_command(trace_id: &str, verbose: bool) -> anyhow::Result<()> {
    let execution = execute_doctor_flow(trace_id)?;
    print_doctor_human_summary(&execution.report, execution.prefix_setup_plan.as_ref());

    if verbose {
        let pretty = serde_json::to_string_pretty(&execution.as_verbose_payload())
            .context("failed to serialize doctor report")?;
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
