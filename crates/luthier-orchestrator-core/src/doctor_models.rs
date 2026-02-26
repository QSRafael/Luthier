use serde::{Deserialize, Serialize};

use crate::config::{FeatureState, RuntimeCandidate};

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum CheckStatus {
    OK,
    WARN,
    BLOCKER,
    INFO,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DependencyStatus {
    pub name: String,
    pub state: Option<FeatureState>,
    pub status: CheckStatus,
    pub found: bool,
    pub resolved_path: Option<String>,
    pub note: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RuntimeDiscovery {
    pub proton: Option<String>,
    pub wine: Option<String>,
    pub umu_run: Option<String>,
    pub selected_runtime: Option<RuntimeCandidate>,
    pub runtime_status: CheckStatus,
    pub runtime_note: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DoctorReport {
    pub generated_at: String,
    pub has_embedded_config: bool,
    pub runtime: RuntimeDiscovery,
    pub dependencies: Vec<DependencyStatus>,
    pub summary: CheckStatus,
}
