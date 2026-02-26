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
        application::InvalidGameConfigParts::from_issues(issues).into_public_error()
    }

    pub fn validation_issues(&self) -> Option<&[ConfigValidationIssue]> {
        self.layered_ref().validation_issues()
    }

    fn layered_ref(&self) -> LayeredErrorRef<'_> {
        match self {
            Self::AbsolutePathNotAllowed(_) => {
                LayeredErrorRef::Domain(domain::DomainErrorKind::AbsolutePathNotAllowed)
            }
            Self::InvalidRelativePath(_) => {
                LayeredErrorRef::Domain(domain::DomainErrorKind::InvalidRelativePath)
            }
            Self::PathTraversalNotAllowed(_) => {
                LayeredErrorRef::Domain(domain::DomainErrorKind::PathTraversalNotAllowed)
            }
            Self::PathOutsideGameRoot(_) => {
                LayeredErrorRef::Domain(domain::DomainErrorKind::PathOutsideGameRoot)
            }
            Self::InvalidFolderMountTarget(_) => {
                LayeredErrorRef::Domain(domain::DomainErrorKind::InvalidFolderMountTarget)
            }
            Self::DuplicateFolderMountTarget(_) => {
                LayeredErrorRef::Domain(domain::DomainErrorKind::DuplicateFolderMountTarget)
            }
            Self::InvalidGameConfig {
                issues,
                issues_len,
                first_issue,
            } => LayeredErrorRef::Application(application::ApplicationErrorRef::InvalidGameConfig {
                issues: issues.as_slice(),
                issues_len: *issues_len,
                first_issue,
            }),
            Self::Io(_) => LayeredErrorRef::Infrastructure(infrastructure::InfrastructureErrorKind::Io),
            Self::Json(_) => {
                LayeredErrorRef::Infrastructure(infrastructure::InfrastructureErrorKind::Json)
            }
            Self::Orchestrator(_) => LayeredErrorRef::Infrastructure(
                infrastructure::InfrastructureErrorKind::Orchestrator,
            ),
        }
    }
}

#[derive(Debug)]
enum LayeredErrorRef<'a> {
    Domain(domain::DomainErrorKind),
    Application(application::ApplicationErrorRef<'a>),
    Infrastructure(infrastructure::InfrastructureErrorKind),
}

impl<'a> LayeredErrorRef<'a> {
    fn validation_issues(self) -> Option<&'a [ConfigValidationIssue]> {
        match self {
            Self::Application(app_error) => app_error.validation_issues(),
            Self::Domain(kind) => {
                let _ = kind;
                None
            }
            Self::Infrastructure(kind) => {
                let _ = kind;
                None
            }
        }
    }
}

mod domain {
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(super) enum DomainErrorKind {
        AbsolutePathNotAllowed,
        InvalidRelativePath,
        PathTraversalNotAllowed,
        PathOutsideGameRoot,
        InvalidFolderMountTarget,
        DuplicateFolderMountTarget,
    }
}

mod application {
    use super::{ConfigValidationIssue, LuthierError};

    #[derive(Debug)]
    pub(super) struct InvalidGameConfigParts {
        issues: Vec<ConfigValidationIssue>,
        issues_len: usize,
        first_issue: String,
    }

    impl InvalidGameConfigParts {
        pub(super) fn from_issues(issues: Vec<ConfigValidationIssue>) -> Self {
            let first_issue = issues
                .first()
                .map(|issue| format!("{} ({}): {}", issue.field, issue.code, issue.message))
                .unwrap_or_else(|| "unknown validation issue".to_string());

            Self {
                issues_len: issues.len(),
                first_issue,
                issues,
            }
        }

        pub(super) fn into_public_error(self) -> LuthierError {
            LuthierError::InvalidGameConfig {
                issues: self.issues,
                issues_len: self.issues_len,
                first_issue: self.first_issue,
            }
        }
    }

    #[derive(Debug)]
    pub(super) enum ApplicationErrorRef<'a> {
        InvalidGameConfig {
            issues: &'a [ConfigValidationIssue],
            issues_len: usize,
            first_issue: &'a str,
        },
    }

    impl<'a> ApplicationErrorRef<'a> {
        pub(super) fn validation_issues(self) -> Option<&'a [ConfigValidationIssue]> {
            match self {
                Self::InvalidGameConfig {
                    issues,
                    issues_len,
                    first_issue,
                } => {
                    let _ = (issues_len, first_issue);
                    Some(issues)
                }
            }
        }
    }
}

mod infrastructure {
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(super) enum InfrastructureErrorKind {
        Io,
        Json,
        Orchestrator,
    }
}
