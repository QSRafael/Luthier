use thiserror::Error;

#[derive(Debug, Error)]
pub enum CreatorError {
    #[error("absolute path not allowed in game payload: {0}")]
    AbsolutePathNotAllowed(String),

    #[error("path traversal not allowed in game payload: {0}")]
    PathTraversalNotAllowed(String),

    #[error("path is outside game root: {0}")]
    PathOutsideGameRoot(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("orchestrator error: {0}")]
    Orchestrator(#[from] orchestrator_core::OrchestratorError),
}
