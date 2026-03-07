use thiserror::Error;

use crate::trailer::AssetType;

#[derive(Debug, Error)]
pub enum OrchestratorError {
    #[error("payload trailer not found")]
    TrailerNotFound,

    #[error("payload trailer is truncated")]
    TrailerTruncated,

    #[error("payload length is invalid")]
    InvalidLength,

    #[error("manifest contains invalid asset type tag: {0}")]
    InvalidAssetType(u8),

    #[error("manifest contains duplicate asset type: {0:?}")]
    DuplicateAssetType(AssetType),

    #[error("manifest offset/length is out of bounds")]
    InvalidManifestBounds,

    #[error("asset checksum validation failed: {0:?}")]
    InvalidAssetChecksum(AssetType),

    #[error("required asset missing: {0:?}")]
    MissingRequiredAsset(AssetType),

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
