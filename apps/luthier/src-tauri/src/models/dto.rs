use luthier_orchestrator_core::RegistryKey;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateExecutableInput {
    pub base_binary_path: String,
    pub output_path: String,
    pub config_json: String,
    pub backup_existing: bool,
    pub make_executable: bool,
    #[serde(default)]
    pub icon_png_data_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateExecutableOutput {
    pub output_path: String,
    pub config_size_bytes: usize,
    pub config_sha256_hex: String,
    pub resolved_base_binary_path: String,
    pub icon_sidecar_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HashExeInput {
    pub executable_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HashExeOutput {
    pub sha256_hex: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExtractExecutableIconInput {
    pub executable_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExtractExecutableIconOutput {
    pub data_url: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchHeroImageInput {
    pub game_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchHeroImageOutput {
    pub source: String,
    pub image_url: String,
    #[serde(default)]
    pub game_id: Option<u64>,
    #[serde(default)]
    pub candidate_image_urls: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PrepareHeroImageInput {
    pub image_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PrepareHeroImageOutput {
    pub source_url: String,
    pub data_url: String,
    pub width: u32,
    pub height: u32,
    pub original_width: u32,
    pub original_height: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestConfigurationInput {
    pub config_json: String,
    pub game_root: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestConfigurationOutput {
    pub status: String,
    pub missing_files: Vec<String>,
    pub doctor: serde_json::Value,
    pub prefix_setup_plan: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WinetricksAvailableOutput {
    pub source: String,
    pub components: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportRegistryFileInput {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportRegistryFileOutput {
    pub entries: Vec<RegistryKey>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ListChildDirectoriesInput {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ListChildDirectoriesOutput {
    pub path: String,
    pub directories: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ListDirectoryEntriesInput {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ListDirectoryEntriesOutput {
    pub path: String,
    pub directories: Vec<String>,
    pub files: Vec<String>,
}
