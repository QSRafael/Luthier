use std::path::{Path, PathBuf};

use luthier_orchestrator_core::{
    prefix::PrefixSetupPlan,
    process::{CommandExecutionResult, ExternalCommand},
    GameConfig,
};
use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum FlowMountStatus {
    Planned,
    Mounted,
    Unchanged,
}

#[derive(Debug, Clone, Serialize)]
pub struct FlowMountResult {
    pub source_relative_path: String,
    pub target_windows_path: String,
    pub source_unix_path: String,
    pub target_unix_path: String,
    pub status: FlowMountStatus,
    pub changed: bool,
    pub note: Option<String>,
}

pub trait OrchestratorRuntimeFlowPort: Send + Sync {
    fn load_embedded_config_required(&self) -> anyhow::Result<GameConfig>;
    fn resolve_game_root(&self) -> anyhow::Result<PathBuf>;
    fn resolve_relative_path(&self, base: &Path, relative: &str) -> anyhow::Result<PathBuf>;
    fn execute_prefix_setup_plan(
        &self,
        plan: &PrefixSetupPlan,
        env_pairs: &[(String, String)],
        dry_run: bool,
    ) -> Vec<CommandExecutionResult>;
    fn has_mandatory_failures(&self, results: &[CommandExecutionResult]) -> bool;
    fn execute_external_command(
        &self,
        command: &ExternalCommand,
        env_pairs: &[(String, String)],
        dry_run: bool,
    ) -> CommandExecutionResult;
    fn apply_folder_mounts(
        &self,
        config: &GameConfig,
        game_root: &Path,
        prefix_path: &Path,
        dry_run: bool,
    ) -> anyhow::Result<Vec<FlowMountResult>>;
}
