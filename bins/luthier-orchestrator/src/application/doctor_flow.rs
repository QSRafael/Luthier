use luthier_orchestrator_core::{
    doctor::{run_doctor, DoctorReport},
    GameConfig,
};

#[derive(Debug)]
pub struct DoctorFlowExecution {
    pub report: DoctorReport,
}

pub fn execute_doctor_flow(
    embedded_config: Option<&GameConfig>,
) -> anyhow::Result<DoctorFlowExecution> {
    let report = run_doctor(embedded_config);

    Ok(DoctorFlowExecution { report })
}
