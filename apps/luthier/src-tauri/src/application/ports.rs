use std::path::{Path, PathBuf};

use luthier_core::{CreateOrchestratorRequest, CreateOrchestratorResult};
use luthier_orchestrator_core::{
    doctor::DoctorReport, prefix::PrefixSetupPlan, GameConfig, RegistryKey,
};
use serde::{Deserialize, Serialize};

use crate::error::BackendResult;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BackendLogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BackendLogEvent {
    pub level: BackendLogLevel,
    pub event_code: String,
    pub message: String,
    pub context: serde_json::Value,
}

pub trait BackendLoggerPort: Send + Sync {
    fn log(&self, event: &BackendLogEvent) -> BackendResult<()>;
}

pub trait RuntimeEnvironmentPort: Send + Sync {
    fn path_entries(&self) -> Vec<PathBuf>;
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum FileSystemEntryKind {
    File,
    Directory,
    Symlink,
    Other,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FileSystemEntry {
    pub path: PathBuf,
    pub kind: FileSystemEntryKind,
}

pub trait FileSystemPort: Send + Sync {
    fn read_bytes(&self, path: &Path) -> BackendResult<Vec<u8>>;
    fn read_dir(&self, path: &Path) -> BackendResult<Vec<FileSystemEntry>>;
    fn exists(&self, path: &Path) -> bool;
    fn is_file(&self, path: &Path) -> bool;
    fn is_dir(&self, path: &Path) -> bool;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HttpMethod {
    Get,
    Post,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum HttpRequestBody {
    Empty,
    Text(String),
    Bytes(Vec<u8>),
    Json(serde_json::Value),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HttpRequest {
    pub method: HttpMethod,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub query: Vec<(String, String)>,
    pub body: HttpRequestBody,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HttpResponse {
    pub status_code: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

pub trait HttpClientPort: Send + Sync {
    fn send(&self, request: &HttpRequest) -> BackendResult<HttpResponse>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RasterImageFormat {
    Png,
    WebP,
    Ico,
    Jpeg,
    Gif,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResizeFilter {
    Lanczos3,
    Triangle,
    Nearest,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RasterImage {
    pub width: u32,
    pub height: u32,
    pub rgba8: Vec<u8>,
}

pub trait ImageCodecPort: Send + Sync {
    fn decode(&self, bytes: &[u8]) -> BackendResult<RasterImage>;
    fn decode_with_format(
        &self,
        bytes: &[u8],
        format: RasterImageFormat,
    ) -> BackendResult<RasterImage>;
    fn encode(&self, image: &RasterImage, format: RasterImageFormat) -> BackendResult<Vec<u8>>;
    fn crop_imm(
        &self,
        image: &RasterImage,
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    ) -> BackendResult<RasterImage>;
    fn resize_exact(
        &self,
        image: &RasterImage,
        width: u32,
        height: u32,
        filter: ResizeFilter,
    ) -> BackendResult<RasterImage>;
    fn thumbnail(
        &self,
        image: &RasterImage,
        max_width: u32,
        max_height: u32,
    ) -> BackendResult<RasterImage>;
}

pub trait PeIconReaderPort: Send + Sync {
    fn read_ico_icon_groups(&self, executable_bytes: &[u8]) -> BackendResult<Vec<Vec<u8>>>;
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RegistryParseOutput {
    pub entries: Vec<RegistryKey>,
    pub warnings: Vec<String>,
}

pub trait RegistryParserPort: Send + Sync {
    fn decode_text(&self, bytes: &[u8]) -> BackendResult<String>;
    fn parse_entries(&self, raw: &str) -> RegistryParseOutput;
}

pub trait WinetricksCatalogParserPort: Send + Sync {
    fn parse_components(&self, raw: &str) -> Vec<String>;
    fn fallback_components(&self) -> Vec<String>;
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExternalCommandRequest {
    pub program: PathBuf,
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
    pub current_dir: Option<PathBuf>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExternalCommandOutput {
    pub success: bool,
    pub status_code: Option<i32>,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

pub trait ProcessRunnerPort: Send + Sync {
    fn run(&self, request: &ExternalCommandRequest) -> BackendResult<ExternalCommandOutput>;
}

pub trait JsonCodecPort: Send + Sync {
    fn parse_game_config(&self, raw: &str) -> BackendResult<GameConfig>;
    fn to_json_value_doctor_report(
        &self,
        report: &DoctorReport,
    ) -> BackendResult<serde_json::Value>;
    fn to_json_value_prefix_setup_plan(
        &self,
        plan: &PrefixSetupPlan,
    ) -> BackendResult<serde_json::Value>;
}

pub trait LuthierCorePort: Send + Sync {
    fn create_orchestrator_binary(
        &self,
        request: &CreateOrchestratorRequest,
    ) -> BackendResult<CreateOrchestratorResult>;
    fn sha256_file(&self, path: &Path) -> BackendResult<String>;
    fn validate_game_config(&self, config: &GameConfig) -> BackendResult<()>;
}

pub trait OrchestratorRuntimeInspectorPort: Send + Sync {
    fn run_doctor(&self, config: Option<&GameConfig>) -> BackendResult<DoctorReport>;
    fn build_prefix_setup_plan(&self, config: &GameConfig) -> BackendResult<PrefixSetupPlan>;
}
