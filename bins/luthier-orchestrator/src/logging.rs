use std::io;

use luthier_orchestrator_core::observability::{emit_ndjson, LogEvent, LogIdentity, LogLevel};

pub fn log_event(
    trace_id: &str,
    level: LogLevel,
    span_id: &str,
    code: &str,
    message: &str,
    context: serde_json::Value,
) {
    let event = LogEvent::new(
        level,
        code,
        message,
        LogIdentity::new(trace_id, span_id, "unknown", "luthier-orchestrator"),
        context,
    );

    let mut stderr = io::stderr();
    let _ = emit_ndjson(&mut stderr, &event);
}
