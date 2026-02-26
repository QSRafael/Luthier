use std::path::PathBuf;

use luthier_orchestrator_core::prefix::PrefixSetupPlan;
use serde::Serialize;

pub type EnvPairs = Vec<(String, String)>;

#[derive(Debug, Clone, Serialize)]
pub struct LaunchCommandPlan {
    pub program: String,
    pub args: Vec<String>,
    pub cwd: String,
    pub runtime: String,
    pub env: EnvPairs,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub notes: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct PrefixSetupExecutionContext {
    pub plan: PrefixSetupPlan,
    pub env: EnvPairs,
    pub prefix_root_path: PathBuf,
    pub effective_prefix_path: PathBuf,
}

#[derive(Debug, Clone)]
pub(crate) enum RegValueKind {
    String(String),
    Dword(u32),
    Delete,
}

#[derive(Debug, Clone)]
pub(crate) struct RegMutation {
    pub(crate) name: String,
    pub(crate) kind: RegValueKind,
}
