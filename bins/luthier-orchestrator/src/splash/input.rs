use anyhow::{anyhow, Context};
use minifb::{Icon, MouseButton, MouseMode, Scale, Window, WindowOptions};

use crate::application::runtime_overrides::RuntimeOverrides;
use crate::splash::state::{MouseSnapshot, Rect};
use crate::splash::theme::{FPS, WIN_H, WIN_W};
use crate::splash::SplashWindowScale;

/// Reads current mouse position and button state from the window.
/// `last_left_down` is the `left_down` value from the previous frame, used to
/// detect a rising edge (press event).
pub fn read_mouse(window: &Window, last_left_down: bool) -> MouseSnapshot {
    let (mx, my) = window
        .get_mouse_pos(MouseMode::Clamp)
        .unwrap_or((-1.0, -1.0));
    let left_down = window.get_mouse_down(MouseButton::Left);
    MouseSnapshot {
        x: mx as i32,
        y: my as i32,
        left_down,
        left_pressed: left_down && !last_left_down,
    }
}

/// Cycles the override value for the given feature key:
/// `None` → `Some(true)` → `Some(false)` → `None`.
pub fn cycle_override_for_key(overrides: &mut RuntimeOverrides, key: &str) {
    let target = match key {
        "gamescope" => &mut overrides.gamescope,
        "mangohud" => &mut overrides.mangohud,
        "gamemode" => &mut overrides.gamemode,
        "umu" => &mut overrides.umu,
        "winetricks" => &mut overrides.winetricks,
        "steam_runtime" => &mut overrides.steam_runtime,
        "prime_offload" => &mut overrides.prime_offload,
        "wine_wayland" => &mut overrides.wine_wayland,
        "hdr" => &mut overrides.hdr,
        "auto_dxvk_nvapi" => &mut overrides.auto_dxvk_nvapi,
        "easy_anti_cheat_runtime" => &mut overrides.easy_anti_cheat_runtime,
        "battleye_runtime" => &mut overrides.battleye_runtime,
        _ => return,
    };

    *target = match *target {
        None => Some(true),
        Some(true) => Some(false),
        Some(false) => None,
    };
}

/// Creates and positions the splash window with the proper scale.
pub fn create_window(title: &str) -> anyhow::Result<Window> {
    let screen = detect_screen_size().unwrap_or((1280, 720));
    let scale = choose_splash_window_scale(screen);
    let mut window = Window::new(
        title,
        WIN_W,
        WIN_H,
        WindowOptions {
            resize: false,
            scale: scale.minifb_scale,
            borderless: true,
            topmost: true,
            transparency: false,
            none: false,
            scale_mode: minifb::ScaleMode::Stretch,
            title: false,
        },
    )
    .map_err(|err| anyhow!("failed to create splash window: {err}"))?;

    let _ = try_center_window(&mut window, scale.factor);
    // Some X11 WMs only honor position after the window is mapped once.
    window.update();
    let _ = try_center_window(&mut window, scale.factor);
    let _ = try_set_window_icon_from_sidecar(&mut window);
    window.set_target_fps(FPS as usize);
    Ok(window)
}

pub fn try_center_window(window: &mut Window, scale_factor: i32) -> anyhow::Result<()> {
    let screen = detect_screen_size().unwrap_or((1280, 720));
    let physical_w = (WIN_W as i32 * scale_factor.max(1)).max(1);
    let physical_h = (WIN_H as i32 * scale_factor.max(1)).max(1);
    let x = ((screen.0 as i32 - physical_w) / 2).max(0);
    let y = ((screen.1 as i32 - physical_h) / 2).max(0);
    window.set_position(x as isize, y as isize);
    Ok(())
}

/// Computes the integer scale factor that best fits the splash canvas to the screen.
pub fn choose_splash_window_scale(screen: (usize, usize)) -> SplashWindowScale {
    // Best practice here: keep a stable logical canvas (96:31) and scale in integer steps.
    // This preserves layout/text metrics while making the splash proportional to the monitor.
    let (sw, sh) = screen;
    if sw >= 2200 && sh >= 900 {
        SplashWindowScale {
            minifb_scale: Scale::X2,
            factor: 2,
        }
    } else {
        SplashWindowScale {
            minifb_scale: Scale::X1,
            factor: 1,
        }
    }
}

/// Tries to detect the physical screen resolution using xrandr or xdpyinfo.
/// Returns `None` on failure; callers should fall back to a safe default.
pub fn detect_screen_size() -> Option<(usize, usize)> {
    // Best-effort only. If unavailable, the window still opens with the WM default placement.
    // On Wayland, many compositors ignore client positioning entirely even if we know the size.
    use std::process::Command;
    if let Ok(out) = Command::new("xrandr").arg("--current").output() {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            for line in stdout.lines() {
                if let Some(idx) = line.find(" current ") {
                    let tail = &line[idx + " current ".len()..];
                    if let Some((w, rest)) = tail.split_once(" x ") {
                        let width = w.trim().parse::<usize>().ok()?;
                        let height = rest
                            .split(',')
                            .next()
                            .and_then(|v| v.trim().parse::<usize>().ok())?;
                        return Some((width, height));
                    }
                }
            }
        }
    }
    if let Ok(out) = Command::new("xdpyinfo").output() {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            for line in stdout.lines() {
                let line = line.trim();
                if let Some(rest) = line.strip_prefix("dimensions:") {
                    let dims = rest.trim();
                    if let Some((w, h_rest)) = dims.split_once('x') {
                        let width = w.trim().parse::<usize>().ok()?;
                        let height = h_rest
                            .split_whitespace()
                            .next()
                            .and_then(|v| v.parse::<usize>().ok())?;
                        return Some((width, height));
                    }
                }
            }
        }
    }
    None
}

pub fn try_set_window_icon_from_sidecar(window: &mut Window) -> anyhow::Result<()> {
    #[cfg(not(target_os = "linux"))]
    {
        let _ = window;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        if is_wayland_session_for_splash() {
            return Ok(());
        }

        let exe = std::env::current_exe().context("failed to resolve current executable")?;
        let icon_path = exe.with_extension("png");
        if !icon_path.exists() {
            return Ok(());
        }

        let raw = std::fs::read(&icon_path).with_context(|| {
            format!(
                "failed to read splash icon sidecar at {}",
                icon_path.display()
            )
        })?;
        let icon_buffer = decode_png_icon_to_x11_buffer(&raw).with_context(|| {
            format!(
                "failed to decode splash icon sidecar {}",
                icon_path.display()
            )
        })?;

        if let Ok(icon) = Icon::try_from(icon_buffer.as_slice()) {
            // minifb panics on Wayland if set_icon is called at runtime.
            let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                window.set_icon(icon);
            }));
        }
        Ok(())
    }
}

#[cfg(target_os = "linux")]
fn is_wayland_session_for_splash() -> bool {
    if std::env::var_os("WAYLAND_DISPLAY").is_some() {
        return true;
    }

    std::env::var("XDG_SESSION_TYPE")
        .ok()
        .map(|value| value.eq_ignore_ascii_case("wayland"))
        .unwrap_or(false)
}

#[cfg(target_os = "linux")]
fn decode_png_icon_to_x11_buffer(png_bytes: &[u8]) -> anyhow::Result<Vec<u64>> {
    use png::{ColorType, Decoder, Transformations};

    let mut decoder = Decoder::new(std::io::Cursor::new(png_bytes));
    decoder.set_transformations(
        Transformations::EXPAND | Transformations::STRIP_16 | Transformations::ALPHA,
    );
    let mut reader = decoder.read_info().context("png read_info failed")?;
    let mut buf = vec![0u8; reader.output_buffer_size()];
    let info = reader
        .next_frame(&mut buf)
        .context("png next_frame failed")?;
    let bytes = &buf[..info.buffer_size()];
    let width = info.width as usize;
    let height = info.height as usize;

    if width == 0 || height == 0 {
        return Err(anyhow!("png icon has invalid size"));
    }

    let mut out = Vec::with_capacity(2 + (width * height));
    out.push(width as u64);
    out.push(height as u64);

    match info.color_type {
        ColorType::Rgba => {
            for px in bytes.chunks_exact(4) {
                let r = px[0] as u32;
                let g = px[1] as u32;
                let b = px[2] as u32;
                let a = px[3] as u32;
                out.push(((a << 24) | (r << 16) | (g << 8) | b) as u64);
            }
        }
        ColorType::Rgb => {
            for px in bytes.chunks_exact(3) {
                let r = px[0] as u32;
                let g = px[1] as u32;
                let b = px[2] as u32;
                out.push(((0xffu32 << 24) | (r << 16) | (g << 8) | b) as u64);
            }
        }
        ColorType::Grayscale => {
            for gray in bytes.iter().copied() {
                let c = gray as u32;
                out.push(((0xffu32 << 24) | (c << 16) | (c << 8) | c) as u64);
            }
        }
        ColorType::GrayscaleAlpha => {
            for px in bytes.chunks_exact(2) {
                let c = px[0] as u32;
                let a = px[1] as u32;
                out.push(((a << 24) | (c << 16) | (c << 8) | c) as u64);
            }
        }
        ColorType::Indexed => return Err(anyhow!("indexed png icon not expanded")),
    }

    Ok(out)
}

/// Returns the hitbox `Rect` for each button in the prelaunch screen.
pub fn prelaunch_button_rects(win_w: i32, win_h: i32, gear_visible: bool) -> PrelaunchRects {
    let gear_button = Rect {
        x: win_w - 154,
        y: 20,
        w: 132,
        h: 28,
    };
    let start_button = Rect {
        x: win_w - 134,
        y: win_h - 50,
        w: 104,
        h: 28,
    };
    let exit_button = Rect {
        x: 30,
        y: win_h - 50,
        w: 84,
        h: 28,
    };
    PrelaunchRects {
        gear_button,
        start_button,
        exit_button,
        gear_visible,
    }
}

/// Returns the button rects for the config overlay screen.
pub fn config_button_rects(win_w: i32, win_h: i32) -> ConfigRects {
    ConfigRects {
        save_button: Rect {
            x: win_w - 126,
            y: win_h - 50,
            w: 96,
            h: 28,
        },
        cancel_button: Rect {
            x: 30,
            y: win_h - 50,
            w: 96,
            h: 28,
        },
    }
}

/// Button rects for the doctor-block screen.
pub fn doctor_exit_button_rect(win_w: i32, win_h: i32) -> Rect {
    Rect {
        x: (win_w / 2) - 70,
        y: win_h - 64,
        w: 140,
        h: 36,
    }
}

/// Button rects for the post-game feedback screen.
pub fn feedback_button_rects(win_w: i32, win_h: i32) -> (Rect, Rect) {
    let left = Rect {
        x: (win_w / 2) - 120,
        y: win_h - 58,
        w: 104,
        h: 28,
    };
    let right = Rect {
        x: (win_w / 2) + 16,
        y: win_h - 58,
        w: 104,
        h: 28,
    };
    (left, right)
}

/// Aggregated hitboxes for the prelaunch screen.
pub struct PrelaunchRects {
    pub gear_button: Rect,
    pub start_button: Rect,
    pub exit_button: Rect,
    pub gear_visible: bool,
}

/// Aggregated hitboxes for the config overlay screen.
pub struct ConfigRects {
    pub save_button: Rect,
    pub cancel_button: Rect,
}
