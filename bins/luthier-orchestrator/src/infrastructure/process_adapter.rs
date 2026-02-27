use luthier_orchestrator_core::prefix::PrefixSetupPlan;

pub use luthier_orchestrator_core::process::{
    CommandExecutionResult, ExternalCommand, StepStatus,
};

pub fn execute_prefix_setup_plan(
    plan: &PrefixSetupPlan,
    env_pairs: &[(String, String)],
    dry_run: bool,
) -> Vec<CommandExecutionResult> {
    luthier_orchestrator_core::process::execute_prefix_setup_plan(plan, env_pairs, dry_run)
}

pub fn execute_external_command(
    command: &ExternalCommand,
    env_pairs: &[(String, String)],
    dry_run: bool,
) -> CommandExecutionResult {
    luthier_orchestrator_core::process::execute_external_command(command, env_pairs, dry_run)
}

pub fn has_mandatory_failures(results: &[CommandExecutionResult]) -> bool {
    luthier_orchestrator_core::process::has_mandatory_failures(results)
}
