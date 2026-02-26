use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConfigValidationIssue {
    pub code: String,
    pub field: String,
    pub message: String,
}

#[derive(Debug, Error)]
pub enum LuthierError {
    #[error("absolute path not allowed in game payload: {0}")]
    AbsolutePathNotAllowed(String),

    #[error("invalid relative path in game payload: {0}")]
    InvalidRelativePath(String),

    #[error("path traversal not allowed in game payload: {0}")]
    PathTraversalNotAllowed(String),

    #[error("path is outside game root: {0}")]
    PathOutsideGameRoot(String),

    #[error("invalid folder mount target windows path: {0}")]
    InvalidFolderMountTarget(String),

    #[error("duplicate folder mount target windows path: {0}")]
    DuplicateFolderMountTarget(String),

    #[error("invalid game config ({issues_len} issue(s)); first: {first_issue}")]
    InvalidGameConfig {
        issues: Vec<ConfigValidationIssue>,
        issues_len: usize,
        first_issue: String,
    },

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("orchestrator error: {0}")]
    Orchestrator(#[from] luthier_orchestrator_core::OrchestratorError),
}

impl LuthierError {
    pub fn invalid_game_config(issues: Vec<ConfigValidationIssue>) -> Self {
        let first_issue = issues
            .first()
            .map(|issue| format!("{} ({}): {}", issue.field, issue.code, issue.message))
            .unwrap_or_else(|| "unknown validation issue".to_string());

        Self::InvalidGameConfig {
            issues_len: issues.len(),
            first_issue,
            issues,
        }
    }

    pub fn validation_issues(&self) -> Option<&[ConfigValidationIssue]> {
        match self {
            Self::InvalidGameConfig { issues, .. } => Some(issues.as_slice()),
            _ => None,
        }
    }
}
