use thiserror::Error;

#[derive(Debug, Error)]
pub enum OrchestratorError {
    #[error("embedded asset container not found")]
    ContainerNotFound,

    #[error("embedded asset container is truncated")]
    ContainerTruncated,

    #[error("container or asset length is invalid")]
    InvalidLength,

    #[error("container integrity check failed")]
    InvalidChecksum,

    #[error("invalid asset container manifest: {0}")]
    InvalidManifest(String),

    #[error("unsupported asset container manifest version: {0}")]
    InvalidManifestVersion(u32),

    #[error("duplicate asset type in manifest: {0}")]
    DuplicateAssetType(String),

    #[error("required embedded asset is missing: {0}")]
    MissingRequiredAsset(String),

    #[error("asset points outside allowed binary range: {0}")]
    AssetOutOfBounds(String),

    #[error("output path has no parent directory")]
    MissingOutputParent,

    #[error("home directory is not available in environment")]
    MissingHomeDir,

    #[error("post-injection verification failed")]
    VerificationFailed,

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
}
