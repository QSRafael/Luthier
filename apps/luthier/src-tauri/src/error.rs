use std::error::Error as StdError;
use std::fmt;

use serde::{Deserialize, Serialize};

pub type BackendResult<T> = Result<T, BackendError>;
pub type CommandStringResult<T> = Result<T, String>;
pub type CommandSerializableResult<T> = Result<T, BackendErrorResponse>;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BackendErrorResponse {
    pub code: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct BackendError {
    code: String,
    message: String,
    details: Option<serde_json::Value>,
}

impl BackendError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: None,
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new("internal_error", message)
    }

    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self::new("invalid_input", message)
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::new("validation_error", message)
    }

    pub fn code(&self) -> &str {
        &self.code
    }

    pub fn message(&self) -> &str {
        &self.message
    }

    pub fn details(&self) -> Option<&serde_json::Value> {
        self.details.as_ref()
    }

    pub fn with_code(mut self, code: impl Into<String>) -> Self {
        self.code = code.into();
        self
    }

    pub fn with_context(mut self, context: impl AsRef<str>) -> Self {
        let context = context.as_ref().trim();
        if !context.is_empty() {
            self.message = format!("{context}: {}", self.message);
        }
        self
    }

    pub fn with_details_json(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }

    pub fn with_serializable_details<T>(mut self, details: &T) -> Self
    where
        T: Serialize,
    {
        self.details = Some(match serde_json::to_value(details) {
            Ok(value) => value,
            Err(err) => serde_json::json!({
                "details_serialization_error": err.to_string(),
            }),
        });
        self
    }

    pub fn to_string_response(&self) -> String {
        self.message.clone()
    }

    pub fn into_string_response(self) -> String {
        self.message
    }

    pub fn to_serializable_response(&self) -> BackendErrorResponse {
        BackendErrorResponse {
            code: self.code.clone(),
            message: self.message.clone(),
            details: self.details.clone(),
        }
    }

    pub fn into_serializable_response(self) -> BackendErrorResponse {
        BackendErrorResponse {
            code: self.code,
            message: self.message,
            details: self.details,
        }
    }
}

impl fmt::Display for BackendError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl StdError for BackendError {}

impl From<BackendError> for BackendErrorResponse {
    fn from(value: BackendError) -> Self {
        value.into_serializable_response()
    }
}

impl From<BackendError> for String {
    fn from(value: BackendError) -> Self {
        value.into_string_response()
    }
}

impl From<BackendErrorResponse> for String {
    fn from(value: BackendErrorResponse) -> Self {
        value.message
    }
}

impl From<String> for BackendError {
    fn from(value: String) -> Self {
        Self::internal(value)
    }
}

impl From<&str> for BackendError {
    fn from(value: &str) -> Self {
        Self::internal(value.to_owned())
    }
}

impl From<std::io::Error> for BackendError {
    fn from(err: std::io::Error) -> Self {
        BackendError::new("io_error", err.to_string()).with_details_json(serde_json::json!({
            "kind": format!("{:?}", err.kind()),
        }))
    }
}

impl From<serde_json::Error> for BackendError {
    fn from(err: serde_json::Error) -> Self {
        BackendError::new("json_error", err.to_string())
    }
}

impl From<reqwest::Error> for BackendError {
    fn from(err: reqwest::Error) -> Self {
        let status = err.status().map(|value| value.as_u16());
        let code = if err.is_timeout() {
            "http_timeout"
        } else {
            "http_error"
        };
        let mut error = BackendError::new(code, err.to_string());

        if status.is_some() || err.is_connect() || err.is_decode() || err.is_body() {
            error = error.with_details_json(serde_json::json!({
                "status": status,
                "is_connect": err.is_connect(),
                "is_decode": err.is_decode(),
                "is_body": err.is_body(),
                "is_timeout": err.is_timeout(),
            }));
        }

        error
    }
}

impl From<image::ImageError> for BackendError {
    fn from(err: image::ImageError) -> Self {
        BackendError::new("image_error", err.to_string())
    }
}

impl From<pelite::Error> for BackendError {
    fn from(err: pelite::Error) -> Self {
        BackendError::new("pe_error", err.to_string())
    }
}

impl From<luthier_orchestrator_core::OrchestratorError> for BackendError {
    fn from(err: luthier_orchestrator_core::OrchestratorError) -> Self {
        BackendError::new("orchestrator_error", err.to_string())
    }
}

impl From<luthier_core::LuthierError> for BackendError {
    fn from(err: luthier_core::LuthierError) -> Self {
        let validation_details = err.validation_issues().map(|issues| {
            serde_json::json!({
                "validation_issues": issues,
            })
        });
        let message = err.to_string();

        let mut backend_error = if validation_details.is_some() {
            BackendError::validation(message)
        } else {
            BackendError::new("luthier_core_error", message)
        };

        if let Some(details) = validation_details {
            backend_error = backend_error.with_details_json(details);
        }

        backend_error
    }
}

impl From<base64::DecodeError> for BackendError {
    fn from(err: base64::DecodeError) -> Self {
        BackendError::new("base64_decode_error", err.to_string())
    }
}

impl From<std::env::VarError> for BackendError {
    fn from(err: std::env::VarError) -> Self {
        BackendError::new("env_error", err.to_string())
    }
}

impl From<std::str::Utf8Error> for BackendError {
    fn from(err: std::str::Utf8Error) -> Self {
        BackendError::new("utf8_error", err.to_string())
    }
}

impl From<std::string::FromUtf8Error> for BackendError {
    fn from(err: std::string::FromUtf8Error) -> Self {
        BackendError::new("utf8_error", err.to_string())
    }
}

impl From<std::num::ParseIntError> for BackendError {
    fn from(err: std::num::ParseIntError) -> Self {
        BackendError::new("parse_int_error", err.to_string())
    }
}

pub trait BackendResultExt<T> {
    fn into_command_string_result(self) -> CommandStringResult<T>;
    fn into_command_serializable_result(self) -> CommandSerializableResult<T>;
}

impl<T, E> BackendResultExt<T> for Result<T, E>
where
    E: Into<BackendError>,
{
    fn into_command_string_result(self) -> CommandStringResult<T> {
        self.map_err(|err| err.into().into_string_response())
    }

    fn into_command_serializable_result(self) -> CommandSerializableResult<T> {
        self.map_err(|err| err.into().into_serializable_response())
    }
}
