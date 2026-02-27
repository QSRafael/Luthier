use serde_json::Value;

use super::state::ProgressViewState;
use super::text::{t, t_installing_winetricks, SplashTextKey};

pub(crate) fn parse_ndjson_event(line: &str) -> Option<Value> {
    if !line.starts_with('{') || !line.contains("\"event_code\"") {
        return None;
    }
    serde_json::from_str::<Value>(line).ok()
}

pub(crate) fn apply_progress_from_log_event(progress: &mut ProgressViewState, event: &Value) {
    let code = event
        .get("event_code")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let ctx = event.get("context");

    match code {
        "GO-CFG-020" => progress.set_status(t(SplashTextKey::StatusPreparingEnvironment)),
        "GO-LN-010" => progress.set_status(t(SplashTextKey::StatusPreparingEnvironment)),
        "GO-PF-020" => {
            let needs_init = ctx
                .and_then(|v| v.get("needs_init"))
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let steps = ctx
                .and_then(|v| v.get("steps"))
                .and_then(Value::as_u64)
                .unwrap_or(0);
            if needs_init {
                progress.set_status(t(SplashTextKey::StatusCreatingPrefix));
            } else if steps > 0 {
                progress.set_status(t(SplashTextKey::StatusPreparingPrefixDependencies));
            } else {
                progress.set_status(t(SplashTextKey::StatusPrefixAlreadyConfigured));
            }
        }
        "GO-RG-020" => {
            let status = ctx
                .and_then(|v| v.get("status"))
                .and_then(Value::as_str)
                .unwrap_or("");
            if status.eq_ignore_ascii_case("Skipped") {
                progress.set_status(t(SplashTextKey::StatusRegistryAlreadyConfigured));
            } else {
                progress.set_status(t(SplashTextKey::StatusRegistryApplied));
            }
        }
        "GO-WC-030" => {
            let status = ctx
                .and_then(|v| v.get("status"))
                .and_then(Value::as_str)
                .unwrap_or("");
            if status.eq_ignore_ascii_case("Skipped") {
                progress.set_status(t(SplashTextKey::StatusWinecfgAlreadyApplied));
            } else {
                progress.set_status(t(SplashTextKey::StatusWinecfgApplied));
            }
        }
        "GO-MT-020" => progress.set_status(t(SplashTextKey::StatusMountingFolders)),
        "GO-SC-020" => progress.set_status(t(SplashTextKey::StatusRunningPreparation)),
        "GO-LN-015" => {
            progress.game_command_started = true;
            progress.set_status(t(SplashTextKey::StatusLaunchingGame));
        }
        _ => {}
    }
}

pub(crate) fn map_external_runtime_line_to_status(line: &str) -> Option<String> {
    if line.contains("Running winetricks verbs in prefix:") {
        let verbs = line
            .split("Running winetricks verbs in prefix:")
            .nth(1)
            .map(str::trim)
            .unwrap_or("");
        return Some(t_installing_winetricks(verbs));
    }

    None
}
