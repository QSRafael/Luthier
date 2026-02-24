use thiserror::Error;

#[derive(Debug, Error)]
pub enum OrchestratorError {
    #[error("payload trailer not found")]
    TrailerNotFound,

    #[error("payload trailer is truncated")]
    TrailerTruncated,

    #[error("payload length is invalid")]
    InvalidLength,

    #[error("payload integrity check failed")]
    InvalidChecksum,

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
}
