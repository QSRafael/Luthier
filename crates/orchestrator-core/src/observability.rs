use std::io::Write;

use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "UPPERCASE")]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LogEvent {
    pub ts: String,
    pub level: LogLevel,
    pub event_code: String,
    pub message: String,
    pub trace_id: String,
    pub span_id: String,
    pub exe_hash: String,
    pub component: String,
    pub context: Value,
}

impl LogEvent {
    pub fn new(
        level: LogLevel,
        event_code: impl Into<String>,
        message: impl Into<String>,
        trace_id: impl Into<String>,
        span_id: impl Into<String>,
        exe_hash: impl Into<String>,
        component: impl Into<String>,
        context: Value,
    ) -> Self {
        Self {
            ts: now_utc_rfc3339_millis(),
            level,
            event_code: event_code.into(),
            message: message.into(),
            trace_id: trace_id.into(),
            span_id: span_id.into(),
            exe_hash: exe_hash.into(),
            component: component.into(),
            context,
        }
    }
}

pub fn now_utc_rfc3339_millis() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

pub fn new_trace_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn emit_ndjson<W: Write>(writer: &mut W, event: &LogEvent) -> std::io::Result<()> {
    serde_json::to_writer(&mut *writer, event)
        .map_err(|err| std::io::Error::new(std::io::ErrorKind::InvalidData, err.to_string()))?;
    writer.write_all(b"\n")?;
    writer.flush()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn emits_single_json_line() {
        let mut buffer = Vec::<u8>::new();
        let event = LogEvent::new(
            LogLevel::Info,
            "GO-DR-001",
            "doctor_started",
            "trace-1",
            "doctor",
            "hash-1",
            "doctor",
            serde_json::json!({"stage": "runtime"}),
        );

        emit_ndjson(&mut buffer, &event).expect("write event");
        let rendered = String::from_utf8(buffer).expect("utf8");

        assert!(rendered.ends_with('\n'));
        assert!(rendered.contains("GO-DR-001"));
    }
}
