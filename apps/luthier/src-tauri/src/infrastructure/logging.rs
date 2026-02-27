use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::application::ports::{BackendLogEvent, BackendLogLevel, BackendLoggerPort};
use crate::error::BackendResult;

pub const DEFAULT_BACKEND_COMPONENT: &str = "luthier-backend";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BackendLogPayload {
    pub ts_ms: u64,
    pub level: String,
    pub component: String,
    pub event_code: String,
    pub message: String,
    pub pid: u32,
    pub context: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct StderrJsonBackendLogger {
    component: String,
}

impl Default for StderrJsonBackendLogger {
    fn default() -> Self {
        Self::new()
    }
}

impl StderrJsonBackendLogger {
    pub fn new() -> Self {
        Self {
            component: DEFAULT_BACKEND_COMPONENT.to_string(),
        }
    }

    pub fn emit_event(&self, event: &BackendLogEvent) -> BackendResult<()> {
        let payload = self.build_payload(
            format_backend_log_level(event.level),
            &event.event_code,
            &event.message,
            event.context.clone(),
        );
        self.write_payload(&payload)
    }

    pub fn emit_raw(
        &self,
        level: &str,
        event_code: &str,
        message: &str,
        context: serde_json::Value,
    ) -> BackendResult<()> {
        let payload = self.build_payload(level, event_code, message, context);
        self.write_payload(&payload)
    }

    pub fn build_payload(
        &self,
        level: &str,
        event_code: &str,
        message: &str,
        context: serde_json::Value,
    ) -> BackendLogPayload {
        BackendLogPayload {
            ts_ms: unix_time_ms_now(),
            level: level.to_string(),
            component: self.component.clone(),
            event_code: event_code.to_string(),
            message: message.to_string(),
            pid: std::process::id(),
            context,
        }
    }

    pub fn write_payload(&self, payload: &BackendLogPayload) -> BackendResult<()> {
        let line = serde_json::to_string(payload)?;
        eprintln!("{line}");
        Ok(())
    }
}

impl BackendLoggerPort for StderrJsonBackendLogger {
    fn log(&self, event: &BackendLogEvent) -> BackendResult<()> {
        self.emit_event(event)
    }
}

pub fn format_backend_log_level(level: BackendLogLevel) -> &'static str {
    match level {
        BackendLogLevel::Trace => "TRACE",
        BackendLogLevel::Debug => "DEBUG",
        BackendLogLevel::Info => "INFO",
        BackendLogLevel::Warn => "WARN",
        BackendLogLevel::Error => "ERROR",
    }
}

pub fn try_log_backend_event(
    level: &str,
    event_code: &str,
    message: &str,
    context: serde_json::Value,
) -> BackendResult<()> {
    StderrJsonBackendLogger::new().emit_raw(level, event_code, message, context)
}

pub fn log_backend_event(level: &str, event_code: &str, message: &str, context: serde_json::Value) {
    if let Err(err) = try_log_backend_event(level, event_code, message, context) {
        let fallback = serde_json::json!({
            "ts_ms": unix_time_ms_now(),
            "level": "ERROR",
            "component": DEFAULT_BACKEND_COMPONENT,
            "event_code": "GO-LOG-001",
            "message": "failed to emit backend log",
            "pid": std::process::id(),
            "context": {
                "error": err.to_string(),
                "original_level": level,
                "original_event_code": event_code,
                "original_message": message,
            }
        });
        eprintln!("{fallback}");
    }
}

fn unix_time_ms_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .ok()
        .and_then(|millis| u64::try_from(millis).ok())
        .unwrap_or(0)
}
