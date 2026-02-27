use luthier_orchestrator_core::RegistryKey;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportRegistryFileInput {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportRegistryFileOutput {
    pub entries: Vec<RegistryKey>,
    pub warnings: Vec<String>,
}
