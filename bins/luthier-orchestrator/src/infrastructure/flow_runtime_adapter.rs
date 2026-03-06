use std::path::{Path, PathBuf};

use luthier_orchestrator_core::{
    prefix::PrefixSetupPlan,
    process::{CommandExecutionResult, ExternalCommand},
    GameConfig,
};

use crate::application::ports::{FlowMountResult, FlowMountStatus, OrchestratorRuntimeFlowPort};
use crate::infrastructure::{
    mounts_adapter::{self, MountStatus},
    paths, payload_loader, process_adapter,
};

#[derive(Debug, Clone, Copy, Default)]
pub struct NativeOrchestratorRuntimeFlowAdapter;

impl OrchestratorRuntimeFlowPort for NativeOrchestratorRuntimeFlowAdapter {
    fn load_embedded_config_required(&self) -> anyhow::Result<GameConfig> {
        payload_loader::load_embedded_config_required()
    }

    fn resolve_game_root(&self) -> anyhow::Result<PathBuf> {
        paths::resolve_game_root()
    }

    fn resolve_relative_path(&self, base: &Path, relative: &str) -> anyhow::Result<PathBuf> {
        paths::resolve_relative_path(base, relative)
    }

    fn execute_prefix_setup_plan(
        &self,
        plan: &PrefixSetupPlan,
        env_pairs: &[(String, String)],
        dry_run: bool,
    ) -> Vec<CommandExecutionResult> {
        process_adapter::execute_prefix_setup_plan(plan, env_pairs, dry_run)
    }

    fn has_mandatory_failures(&self, results: &[CommandExecutionResult]) -> bool {
        process_adapter::has_mandatory_failures(results)
    }

    fn execute_external_command(
        &self,
        command: &ExternalCommand,
        env_pairs: &[(String, String)],
        dry_run: bool,
    ) -> CommandExecutionResult {
        process_adapter::execute_external_command(command, env_pairs, dry_run)
    }

    fn apply_folder_mounts(
        &self,
        config: &GameConfig,
        game_root: &Path,
        prefix_path: &Path,
        dry_run: bool,
    ) -> anyhow::Result<Vec<FlowMountResult>> {
        mounts_adapter::apply_folder_mounts(config, game_root, prefix_path, dry_run).map(
            |results| {
                results
                    .into_iter()
                    .map(|result| FlowMountResult {
                        source_relative_path: result.source_relative_path,
                        target_windows_path: result.target_windows_path,
                        source_unix_path: result.source_unix_path,
                        target_unix_path: result.target_unix_path,
                        status: map_mount_status(result.status),
                        changed: result.changed,
                        note: result.note,
                    })
                    .collect()
            },
        )
    }
}

fn map_mount_status(status: MountStatus) -> FlowMountStatus {
    match status {
        MountStatus::Planned => FlowMountStatus::Planned,
        MountStatus::Mounted => FlowMountStatus::Mounted,
        MountStatus::Unchanged => FlowMountStatus::Unchanged,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_mount_status_variants_without_loss() {
        assert!(matches!(
            map_mount_status(MountStatus::Planned),
            FlowMountStatus::Planned
        ));
        assert!(matches!(
            map_mount_status(MountStatus::Mounted),
            FlowMountStatus::Mounted
        ));
        assert!(matches!(
            map_mount_status(MountStatus::Unchanged),
            FlowMountStatus::Unchanged
        ));
    }
}
