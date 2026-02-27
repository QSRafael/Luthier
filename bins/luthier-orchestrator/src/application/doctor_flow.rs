use anyhow::Context;
use luthier_orchestrator_core::{
    doctor::{run_doctor, DoctorReport},
    observability::LogLevel,
    prefix::{build_prefix_setup_plan, PrefixSetupPlan},
};

use crate::{infrastructure::payload_loader::try_load_embedded_config, logging::log_event};

#[derive(Debug)]
pub struct DoctorFlowExecution {
    pub report: DoctorReport,
    pub prefix_setup_plan: Option<PrefixSetupPlan>,
}

impl DoctorFlowExecution {
    pub fn as_verbose_payload(&self) -> serde_json::Value {
        serde_json::json!({
            "doctor": self.report,
            "prefix_setup_plan": self.prefix_setup_plan,
        })
    }
}

pub fn execute_doctor_flow(trace_id: &str) -> anyhow::Result<DoctorFlowExecution> {
    let embedded_config =
        try_load_embedded_config().context("failed to inspect embedded config")?;
    let prefix_setup_plan = embedded_config
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

    Ok(DoctorFlowExecution {
        report,
        prefix_setup_plan,
    })
}
