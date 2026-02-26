use std::process::Command;

use luthier_orchestrator_core::{doctor::DoctorReport, GameConfig};

use crate::overrides::feature_enabled;

#[derive(Debug, Clone)]
pub struct GamescopeWrapResult {
    pub command_tokens: Vec<String>,
    pub notes: Vec<String>,
}

pub fn apply_gamescope_wrapper_if_enabled(
    config: &GameConfig,
    report: &DoctorReport,
    mut command_tokens: Vec<String>,
) -> GamescopeWrapResult {
    let gamescope_active = feature_enabled(config.environment.gamescope.state);
    let mangohud_active = feature_enabled(config.requirements.mangohud);
    let mut notes = Vec::new();

    if gamescope_active {
        if let Some(path) = dependency_path(report, "gamescope") {
            let mut gamescope_args = Vec::new();
            let gamescope = &config.environment.gamescope;
            let supports_modern_filter = gamescope_supports_modern_filter(&path);

            let game_width = parse_u32_maybe_empty(&gamescope.game_width);
            let game_height = parse_u32_maybe_empty(&gamescope.game_height);
            if let Some(width) = game_width {
                gamescope_args.push("-w".to_string());
                gamescope_args.push(width.to_string());
            }
            if let Some(height) = game_height {
                gamescope_args.push("-h".to_string());
                gamescope_args.push(height.to_string());
            }

            let mut output_width = parse_u32_maybe_empty(&gamescope.output_width);
            let mut output_height = parse_u32_maybe_empty(&gamescope.output_height);
            if output_width.is_none() || output_height.is_none() {
                if let Some(resolution) = &gamescope.resolution {
                    if let Some((w, h)) = parse_resolution(resolution) {
                        output_width.get_or_insert(w);
                        output_height.get_or_insert(h);
                    }
                }
            }
            if let Some(width) = output_width {
                gamescope_args.push("-W".to_string());
                gamescope_args.push(width.to_string());
            }
            if let Some(height) = output_height {
                gamescope_args.push("-H".to_string());
                gamescope_args.push(height.to_string());
            }

            let upscaling_configured = game_width.is_some()
                || game_height.is_some()
                || output_width.is_some()
                || output_height.is_some()
                || gamescope.fsr;
            if upscaling_configured {
                let method = if gamescope.fsr && gamescope.upscale_method.trim().is_empty() {
                    "fsr"
                } else {
                    gamescope.upscale_method.trim()
                };
                apply_gamescope_upscale_flags(&mut gamescope_args, method, supports_modern_filter);
            }

            match gamescope.window_type.trim() {
                "fullscreen" => {
                    gamescope_args.push("-f".to_string());
                    if host_wayland_session_detected() {
                        notes.push(
                            "Gamescope fullscreen flag (-f) was applied. In nested Wayland sessions, compositors may still present the gamescope surface as a window.".to_string(),
                        );
                    }
                }
                "borderless" => gamescope_args.push("-b".to_string()),
                _ => {}
            }

            if gamescope.enable_limiter {
                if let Some(value) = non_empty_trimmed(&gamescope.fps_limiter) {
                    gamescope_args.push("-r".to_string());
                    gamescope_args.push(value.to_string());
                }
                if let Some(value) = non_empty_trimmed(&gamescope.fps_limiter_no_focus) {
                    gamescope_args.push("-o".to_string());
                    gamescope_args.push(value.to_string());
                }
            }

            if gamescope.force_grab_cursor {
                gamescope_args.push("--force-grab-cursor".to_string());
            }

            if mangohud_active {
                gamescope_args.push("--mangoapp".to_string());
            }

            gamescope_args.extend(split_shell_like_args(&gamescope.additional_options));

            gamescope_args.push("--".to_string());
            gamescope_args.extend(command_tokens);
            command_tokens = wrap_command(path, gamescope_args, Vec::new());
        }
    }

    GamescopeWrapResult {
        command_tokens,
        notes,
    }
}

fn dependency_path(report: &DoctorReport, name: &str) -> Option<String> {
    report
        .dependencies
        .iter()
        .find(|dep| dep.name == name && dep.found)
        .and_then(|dep| dep.resolved_path.clone())
}

fn wrap_command(program: String, args: Vec<String>, inner: Vec<String>) -> Vec<String> {
    let mut out = Vec::with_capacity(1 + args.len() + inner.len());
    out.push(program);
    out.extend(args);
    out.extend(inner);
    out
}

fn parse_resolution(raw: &str) -> Option<(u32, u32)> {
    let cleaned = raw.trim().replace('X', "x");
    let (w, h) = cleaned.split_once('x')?;
    let width = w.trim().parse::<u32>().ok()?;
    let height = h.trim().parse::<u32>().ok()?;
    Some((width, height))
}

fn parse_u32_maybe_empty(raw: &str) -> Option<u32> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    trimmed.parse::<u32>().ok()
}

fn non_empty_trimmed(raw: &str) -> Option<&str> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn split_shell_like_args(raw: &str) -> Vec<String> {
    // Matches current wrapper arg parsing behavior. Quoted args are not preserved yet.
    raw.split_whitespace().map(ToString::to_string).collect()
}

fn host_wayland_session_detected() -> bool {
    truthy_env_flag("WAYLAND_DISPLAY")
        || std::env::var("XDG_SESSION_TYPE")
            .map(|value| value.eq_ignore_ascii_case("wayland"))
            .unwrap_or(false)
}

fn truthy_env_flag(name: &str) -> bool {
    std::env::var(name)
        .map(|value| {
            let trimmed = value.trim();
            !trimmed.is_empty()
                && (trimmed == "1"
                    || trimmed.eq_ignore_ascii_case("true")
                    || trimmed.eq_ignore_ascii_case("yes")
                    || trimmed.eq_ignore_ascii_case("on")
                    || (!trimmed.contains('=') && name == "WAYLAND_DISPLAY"))
        })
        .unwrap_or(false)
}

fn gamescope_supports_modern_filter(gamescope_path: &str) -> bool {
    let Ok(output) = Command::new(gamescope_path).arg("--help").output() else {
        return false;
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    stdout.contains("-F, --filter") || stderr.contains("-F, --filter")
}

fn apply_gamescope_upscale_flags(
    gamescope_args: &mut Vec<String>,
    raw_method: &str,
    supports_modern_filter: bool,
) {
    let method = raw_method.trim().to_ascii_lowercase();
    if method.is_empty() {
        return;
    }

    if supports_modern_filter {
        match method.as_str() {
            "fsr" | "nis" => {
                gamescope_args.push("-F".to_string());
                gamescope_args.push(method);
            }
            "integer" | "stretch" => {
                gamescope_args.push("-S".to_string());
                gamescope_args.push(method);
            }
            _ => {}
        }
        return;
    }

    match method.as_str() {
        "fsr" => gamescope_args.push("-U".to_string()),
        "nis" => gamescope_args.push("-Y".to_string()),
        "integer" => gamescope_args.push("-i".to_string()),
        "stretch" => {}
        _ => {}
    }
}
