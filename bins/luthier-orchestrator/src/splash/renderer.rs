use font8x8::{UnicodeFonts, BASIC_FONTS};
use fontdue::Font;
use minifb::Window;

use crate::splash::state::{
    ChildRunOutcome, HeroBackground, MouseSnapshot, PrelaunchState, ProgressViewState, Rect,
    SplashLaunchMode, TextMetrics, ToggleRow,
};
use crate::splash::theme::{
    system_font, BAD, BG, BORDER, BTN, BTN_HOVER, MUTED, SEPARATOR, TEXT, WIN_H, WIN_W,
};
use crate::splash::{t, SplashTextKey};

pub fn draw_splash_background(buffer: &mut [u32], hero_background: Option<&HeroBackground>) {
    draw_splash_background_with_options(buffer, hero_background, true);
}

pub fn draw_splash_background_without_center_scrim(
    buffer: &mut [u32],
    hero_background: Option<&HeroBackground>,
) {
    draw_splash_background_with_options(buffer, hero_background, false);
}

pub fn draw_splash_background_with_options(
    buffer: &mut [u32],
    hero_background: Option<&HeroBackground>,
    extra_center_scrim: bool,
) {
    if let Some(hero) = hero_background {
        if hero.pixels.len() == buffer.len() {
            buffer.copy_from_slice(&hero.pixels);
        } else {
            clear(buffer, BG);
        }
        fill_rect_alpha(
            buffer,
            Rect {
                x: 0,
                y: 0,
                w: WIN_W as i32,
                h: WIN_H as i32,
            },
            0x000000,
            156,
        );
        if extra_center_scrim {
            fill_rect_alpha(
                buffer,
                Rect {
                    x: 0,
                    y: 42,
                    w: WIN_W as i32,
                    h: WIN_H as i32 - 84,
                },
                0x000000,
                72,
            );
        }
    } else {
        clear(buffer, BG);
    }
}

pub fn draw_prelaunch(
    buffer: &mut [u32],
    _window: &Window,
    state: &PrelaunchState,
    countdown_left: i32,
    gear_visible: bool,
    gear_button: Rect,
    start_button: Rect,
    exit_button: Rect,
    mode: SplashLaunchMode,
    mouse: MouseSnapshot,
    hero_background: Option<&HeroBackground>,
) {
    draw_splash_background_without_center_scrim(buffer, hero_background);
    stroke_rect(
        buffer,
        Rect {
            x: 14,
            y: 14,
            w: WIN_W as i32 - 28,
            h: WIN_H as i32 - 28,
        },
        BORDER,
    );

    let game_name = if state.config.game_name.trim().is_empty() {
        t(SplashTextKey::ScreenGame)
    } else {
        state.config.game_name.trim()
    };
    draw_title_centered_fit_with_scrim(buffer, WIN_W as i32 / 2, 52, game_name, TEXT, 78);

    let countdown_key = if countdown_left > 0 {
        t(SplashTextKey::CountdownContinuing).replace("{n}", &countdown_left.to_string())
    } else {
        t(SplashTextKey::CountdownContinuingNow).to_string()
    };
    draw_text_centered_with_scrim(buffer, WIN_W as i32 / 2, 146, &countdown_key, TEXT, 1, 56);

    if gear_visible {
        draw_button_secondary_clean(buffer, gear_button, gear_button.contains(mouse.x, mouse.y));
        draw_button_label_centered(buffer, gear_button, t(SplashTextKey::ScreenConfig), TEXT, 1);
    }

    draw_button_secondary_clean(buffer, exit_button, exit_button.contains(mouse.x, mouse.y));
    draw_button_label_centered(buffer, exit_button, t(SplashTextKey::ActionExit), TEXT, 1);

    draw_button_primary_clean(
        buffer,
        start_button,
        start_button.contains(mouse.x, mouse.y),
    );
    draw_button_label_centered(
        buffer,
        start_button,
        t(SplashTextKey::ActionContinue),
        TEXT,
        1,
    );

    let _ = mode;
}

pub fn draw_config(
    buffer: &mut [u32],
    _window: &Window,
    rows: &[ToggleRow],
    save_button: Rect,
    cancel_button: Rect,
    mouse: &MouseSnapshot,
    hero_background: Option<&HeroBackground>,
) {
    draw_splash_background_without_center_scrim(buffer, hero_background);
    stroke_rect(
        buffer,
        Rect {
            x: 14,
            y: 14,
            w: WIN_W as i32 - 28,
            h: WIN_H as i32 - 28,
        },
        BORDER,
    );
    draw_text_centered_with_scrim(
        buffer,
        WIN_W as i32 / 2,
        28,
        t(SplashTextKey::ScreenConfig),
        TEXT,
        2,
        74,
    );
    draw_text_centered_with_scrim(
        buffer,
        WIN_W as i32 / 2,
        72,
        t(SplashTextKey::ConfigSubtitle),
        MUTED,
        1,
        58,
    );

    if rows.is_empty() {
        draw_text_centered_with_scrim(
            buffer,
            WIN_W as i32 / 2,
            144,
            t(SplashTextKey::ConfigNone),
            MUTED,
            1,
            52,
        );
    } else {
        let layouts = config_toggle_layout(rows.len());
        for (idx, row) in rows.iter().enumerate() {
            let (label_rect, btn) = layouts[idx];
            draw_text_centered_wrapped_in_rect_with_scrim(
                buffer,
                label_rect,
                row.label,
                TEXT,
                1,
                48,
                if label_rect.h <= 18 { 1 } else { 2 },
            );

            draw_button_secondary_clean(buffer, btn, btn.contains(mouse.x, mouse.y));
            let label = match row.value {
                None => t(SplashTextKey::ToggleDefault),
                Some(true) => t(SplashTextKey::ToggleEnabled),
                Some(false) => t(SplashTextKey::ToggleDisabled),
            };
            let text_color = if row.value.is_none() { MUTED } else { TEXT };
            draw_button_label_centered(buffer, btn, label, text_color, 1);
        }
    }

    draw_button_secondary_clean(
        buffer,
        cancel_button,
        cancel_button.contains(mouse.x, mouse.y),
    );
    draw_button_label_centered(buffer, cancel_button, t(SplashTextKey::ActionBack), TEXT, 1);

    draw_button_primary_clean(buffer, save_button, save_button.contains(mouse.x, mouse.y));
    draw_button_label_centered(buffer, save_button, t(SplashTextKey::ActionSave), TEXT, 1);
}

pub fn draw_doctor_block(
    buffer: &mut [u32],
    _window: &Window,
    items: &[(String, bool)],
    exit_button: Rect,
    mouse: &MouseSnapshot,
    hero_background: Option<&HeroBackground>,
) {
    draw_splash_background(buffer, hero_background);
    fill_rect_alpha(
        buffer,
        Rect {
            x: 18,
            y: 18,
            w: WIN_W as i32 - 36,
            h: WIN_H as i32 - 36,
        },
        0x000000,
        104,
    );
    stroke_rect(
        buffer,
        Rect {
            x: 14,
            y: 14,
            w: WIN_W as i32 - 28,
            h: WIN_H as i32 - 28,
        },
        BORDER,
    );
    draw_text(buffer, 28, 28, t(SplashTextKey::MissingDepsTitle), TEXT, 2);
    draw_text(buffer, 28, 62, t(SplashTextKey::MissingDepsHint), MUTED, 1);
    fill_rect(
        buffer,
        Rect {
            x: 28,
            y: 90,
            w: WIN_W as i32 - 56,
            h: 1,
        },
        SEPARATOR,
    );

    let mut y = 108;
    for (name, ok) in items.iter().take(10) {
        let status = if *ok {
            t(SplashTextKey::DepOk)
        } else {
            t(SplashTextKey::DepNotOk)
        };
        draw_text(buffer, 28, y, name, TEXT, 1);
        draw_text(
            buffer,
            WIN_W as i32 - 160,
            y,
            status,
            if *ok { TEXT } else { MUTED },
            1,
        );
        fill_rect(
            buffer,
            Rect {
                x: 28,
                y: y + 18,
                w: WIN_W as i32 - 56,
                h: 1,
            },
            SEPARATOR,
        );
        y += 24;
    }

    draw_button(
        buffer,
        exit_button,
        if exit_button.contains(mouse.x, mouse.y) {
            BTN_HOVER
        } else {
            BTN
        },
        BORDER,
    );
    draw_text(
        buffer,
        exit_button.x + 50,
        exit_button.y + 11,
        t(SplashTextKey::ActionExit),
        TEXT,
        1,
    );
}

pub fn draw_progress(
    buffer: &mut [u32],
    _window: &Window,
    progress: &ProgressViewState,
    _mouse: &MouseSnapshot,
) {
    draw_splash_background_without_center_scrim(buffer, progress.hero_background.as_deref());
    stroke_rect(
        buffer,
        Rect {
            x: 14,
            y: 14,
            w: WIN_W as i32 - 28,
            h: WIN_H as i32 - 28,
        },
        BORDER,
    );

    let game_name = if progress.game_name.trim().is_empty() {
        t(SplashTextKey::ScreenGame)
    } else {
        progress.game_name.trim()
    };
    draw_title_centered_fit_with_scrim(buffer, WIN_W as i32 / 2, 52, game_name, TEXT, 78);

    let current_status = if progress.status.trim().is_empty() {
        t(SplashTextKey::StatusPreparingExecution).to_string()
    } else {
        progress.status.clone()
    };

    draw_text_centered_with_scrim(buffer, WIN_W as i32 / 2, 192, &current_status, TEXT, 1, 54);

    let uptime = format!("{}s", progress.started_at.elapsed().as_secs());
    draw_text_centered_with_scrim(
        buffer,
        WIN_W as i32 / 2,
        WIN_H as i32 - 24,
        &uptime,
        MUTED,
        1,
        28,
    );

    if let Some(err) = &progress.child_failed_to_spawn {
        draw_text_centered_with_scrim(
            buffer,
            WIN_W as i32 / 2,
            WIN_H as i32 - 66,
            t(SplashTextKey::SpawnFailed),
            BAD,
            1,
            56,
        );
        let mut lines = wrap_text_lines(err, WIN_W as i32 - 56, 1);
        lines.truncate(1);
        if let Some(line) = lines.first() {
            draw_text_centered_with_scrim(
                buffer,
                WIN_W as i32 / 2,
                WIN_H as i32 - 48,
                line,
                MUTED,
                1,
                34,
            );
        }
    }
}

pub fn draw_feedback(
    buffer: &mut [u32],
    _window: &Window,
    outcome: &ChildRunOutcome,
    question: i32,
    left: Rect,
    right: Rect,
    mouse: &MouseSnapshot,
) {
    draw_splash_background_without_center_scrim(buffer, outcome.hero_background.as_deref());
    stroke_rect(
        buffer,
        Rect {
            x: 14,
            y: 14,
            w: WIN_W as i32 - 28,
            h: WIN_H as i32 - 28,
        },
        BORDER,
    );
    let game_name = if outcome.game_name.trim().is_empty() {
        t(SplashTextKey::WindowTitle)
    } else {
        outcome.game_name.trim()
    };
    draw_title_centered_fit_with_scrim(buffer, WIN_W as i32 / 2, 38, game_name, TEXT, 78);
    let prompt = if question == 1 {
        t(SplashTextKey::PromptWorked)
    } else {
        t(SplashTextKey::PromptShare)
    };
    let prompt_lines = wrap_text_lines(prompt, WIN_W as i32 - 70, 2);
    let prompt_y = if prompt_lines.len() > 2 { 96 } else { 108 };
    for (i, line) in prompt_lines.iter().take(3).enumerate() {
        draw_text_centered_with_scrim(
            buffer,
            WIN_W as i32 / 2,
            prompt_y + (i as i32 * 28),
            line,
            TEXT,
            2,
            62,
        );
    }

    let left_label = t(SplashTextKey::AnswerYes);
    let right_label = t(SplashTextKey::AnswerNo);

    draw_button_secondary_clean(buffer, left, left.contains(mouse.x, mouse.y));
    draw_button_label_centered(buffer, left, left_label, TEXT, 1);

    draw_button_primary_clean(buffer, right, right.contains(mouse.x, mouse.y));
    draw_button_label_centered(buffer, right, right_label, TEXT, 1);

    if question == 2 {
        draw_text_centered_with_scrim(
            buffer,
            WIN_W as i32 / 2,
            212,
            t(SplashTextKey::FeedbackPlaceholder),
            MUTED,
            1,
            34,
        );
    }
}

pub fn clear(buffer: &mut [u32], color: u32) {
    buffer.fill(color);
}

pub fn fill_rect(buffer: &mut [u32], rect: Rect, color: u32) {
    let x0 = rect.x.max(0) as usize;
    let y0 = rect.y.max(0) as usize;
    let x1 = (rect.x + rect.w).min(WIN_W as i32).max(0) as usize;
    let y1 = (rect.y + rect.h).min(WIN_H as i32).max(0) as usize;

    for y in y0..y1 {
        let row = y * WIN_W;
        for x in x0..x1 {
            buffer[row + x] = color;
        }
    }
}

pub fn fill_rect_alpha(buffer: &mut [u32], rect: Rect, color: u32, alpha: u8) {
    if alpha == 0 {
        return;
    }
    let x0 = rect.x.max(0) as usize;
    let y0 = rect.y.max(0) as usize;
    let x1 = (rect.x + rect.w).min(WIN_W as i32).max(0) as usize;
    let y1 = (rect.y + rect.h).min(WIN_H as i32).max(0) as usize;

    for y in y0..y1 {
        let row = y * WIN_W;
        for x in x0..x1 {
            let idx = row + x;
            buffer[idx] = blend_over(buffer[idx], color, alpha);
        }
    }
}

pub fn stroke_rect(buffer: &mut [u32], rect: Rect, color: u32) {
    fill_rect(
        buffer,
        Rect {
            x: rect.x,
            y: rect.y,
            w: rect.w,
            h: 1,
        },
        color,
    );
    fill_rect(
        buffer,
        Rect {
            x: rect.x,
            y: rect.y + rect.h - 1,
            w: rect.w,
            h: 1,
        },
        color,
    );
    fill_rect(
        buffer,
        Rect {
            x: rect.x,
            y: rect.y,
            w: 1,
            h: rect.h,
        },
        color,
    );
    fill_rect(
        buffer,
        Rect {
            x: rect.x + rect.w - 1,
            y: rect.y,
            w: 1,
            h: rect.h,
        },
        color,
    );
}

pub fn draw_button(buffer: &mut [u32], rect: Rect, fill: u32, border: u32) {
    fill_rect(buffer, rect, fill);
    stroke_rect(buffer, rect, border);
}

pub fn stroke_rect_alpha(buffer: &mut [u32], rect: Rect, color: u32, alpha: u8) {
    if alpha == 0 {
        return;
    }
    fill_rect_alpha(
        buffer,
        Rect {
            x: rect.x,
            y: rect.y,
            w: rect.w,
            h: 1,
        },
        color,
        alpha,
    );
    fill_rect_alpha(
        buffer,
        Rect {
            x: rect.x,
            y: rect.y + rect.h - 1,
            w: rect.w,
            h: 1,
        },
        color,
        alpha,
    );
    fill_rect_alpha(
        buffer,
        Rect {
            x: rect.x,
            y: rect.y,
            w: 1,
            h: rect.h,
        },
        color,
        alpha,
    );
    fill_rect_alpha(
        buffer,
        Rect {
            x: rect.x + rect.w - 1,
            y: rect.y,
            w: 1,
            h: rect.h,
        },
        color,
        alpha,
    );
}

pub fn draw_button_secondary_clean(buffer: &mut [u32], rect: Rect, hovered: bool) {
    draw_soft_scrim_rect(buffer, rect, 0x000000, if hovered { 74 } else { 54 }, 8);
    fill_rect_alpha(buffer, rect, 0x000000, if hovered { 118 } else { 88 });
    stroke_rect_alpha(buffer, rect, 0xffffff, if hovered { 42 } else { 20 });
}

pub fn draw_button_primary_clean(buffer: &mut [u32], rect: Rect, hovered: bool) {
    draw_soft_scrim_rect(buffer, rect, 0x000000, if hovered { 82 } else { 60 }, 9);
    fill_rect_alpha(buffer, rect, 0xffffff, if hovered { 56 } else { 40 });
    stroke_rect_alpha(buffer, rect, 0xffffff, if hovered { 78 } else { 52 });
}

pub fn config_toggle_layout(count: usize) -> Vec<(Rect, Rect)> {
    if count == 0 {
        return Vec::new();
    }
    let cols = if count > 8 {
        4
    } else if count > 4 {
        3
    } else if count > 2 {
        2
    } else {
        1
    };
    let col_gap = match cols {
        4 => 12,
        3 => 14,
        2 => 18,
        _ => 18,
    };
    let inner_w = WIN_W as i32 - 56;
    let col_w = if cols > 1 {
        (inner_w - (col_gap * (cols as i32 - 1))) / cols as i32
    } else {
        inner_w
    };
    let rows = count.div_ceil(cols) as i32;
    let header_bottom = 104;
    let footer_top = WIN_H as i32 - 62;
    let available_h = (footer_top - header_bottom).max(48);
    let row_h = (available_h / rows).clamp(
        if cols >= 4 { 38 } else { 40 },
        if cols >= 3 { 46 } else { 52 },
    );
    let content_h = rows * row_h;
    let start_y = (header_bottom + ((available_h - content_h).max(0) / 2)).max(header_bottom);
    let start_x = 28;

    let mut out = Vec::with_capacity(count);
    for idx in 0..count {
        let col = (idx % cols) as i32;
        let row = (idx / cols) as i32;
        let x = start_x + (col * (col_w + col_gap));
        let y = start_y + (row * row_h);
        let label = Rect {
            x,
            y,
            w: col_w,
            h: if cols >= 4 { 18 } else { 16 },
        };
        let btn_w = match cols {
            4 => (col_w - 24).clamp(100, 170),
            3 => (col_w - 22).clamp(120, 176),
            2 => (col_w - 24).clamp(132, 180),
            _ => (col_w - 24).clamp(132, 220),
        };
        let button_h = if cols >= 4 { 22 } else { 24 };
        let button = Rect {
            x: x + ((col_w - btn_w) / 2),
            y: y + 18,
            w: btn_w,
            h: button_h,
        };
        out.push((label, button));
    }
    out
}

pub fn config_toggle_button_rects(count: usize) -> Vec<Rect> {
    config_toggle_layout(count)
        .into_iter()
        .map(|(_, button)| button)
        .collect()
}

pub fn draw_button_label_centered(
    buffer: &mut [u32],
    rect: Rect,
    text: &str,
    color: u32,
    scale: i32,
) {
    let metrics = measure_text_metrics(text, scale);
    let x = rect.x + ((rect.w - metrics.width) / 2).max(4);
    // `draw_text` uses a y origin above the actual glyph top (fontdue layout offset),
    // so compensate using the measured glyph min_y to visually center in the rect.
    let y = rect.y + ((rect.h - metrics.height) / 2) - metrics.min_y;
    draw_text(buffer, x, y, text, color, scale);
}

pub fn draw_text_centered_with_scrim(
    buffer: &mut [u32],
    center_x: i32,
    y: i32,
    text: &str,
    color: u32,
    scale: i32,
    scrim_alpha: u8,
) {
    let metrics = measure_text_metrics(text, scale);
    let x = (center_x - (metrics.width / 2)).max(18);
    draw_text_soft_scrim(buffer, x, y, &metrics, scrim_alpha);
    draw_text(buffer, x, y, text, color, scale);
}

pub fn draw_title_centered_fit_with_scrim(
    buffer: &mut [u32],
    center_x: i32,
    y: i32,
    text: &str,
    color: u32,
    scrim_alpha: u8,
) {
    let max_w = WIN_W as i32 - 40;
    for scale in [3, 2, 1] {
        if measure_text_width(text, scale) <= max_w {
            draw_text_centered_with_scrim(buffer, center_x, y, text, color, scale, scrim_alpha);
            return;
        }
    }
    let mut line = text.to_string();
    while line.len() > 3 && measure_text_width(&format!("{line}..."), 1) > max_w {
        line.pop();
    }
    draw_text_centered_with_scrim(
        buffer,
        center_x,
        y,
        &format!("{line}..."),
        color,
        1,
        scrim_alpha,
    );
}

pub fn draw_text_soft_scrim(buffer: &mut [u32], x: i32, y: i32, metrics: &TextMetrics, alpha: u8) {
    if alpha == 0 || metrics.width <= 0 || metrics.height <= 0 {
        return;
    }
    let top = y + metrics.min_y;
    let pad_x = if metrics.height >= 22 { 12 } else { 8 };
    let pad_y = if metrics.height >= 22 { 5 } else { 4 };
    let base = Rect {
        x: x - pad_x,
        y: top - pad_y,
        w: metrics.width + (pad_x * 2),
        h: metrics.height + (pad_y * 2),
    };
    draw_soft_scrim_rect(
        buffer,
        base,
        0x000000,
        alpha,
        if metrics.height >= 22 { 10 } else { 7 },
    );
}

pub fn draw_soft_scrim_rect(
    buffer: &mut [u32],
    rect: Rect,
    color: u32,
    core_alpha: u8,
    fade_px: i32,
) {
    if rect.w <= 0 || rect.h <= 0 || core_alpha == 0 {
        return;
    }
    let fade = fade_px.max(0);
    for step in (1..=fade).rev() {
        let ring = Rect {
            x: rect.x - step,
            y: rect.y - step,
            w: rect.w + (step * 2),
            h: rect.h + (step * 2),
        };
        let alpha =
            ((core_alpha as i32 * (fade - step + 1)) / ((fade + 1) * 3)).clamp(0, 255) as u8;
        fill_rect_alpha(buffer, ring, color, alpha);
    }
    fill_rect_alpha(buffer, rect, color, core_alpha);
}

pub fn draw_text_centered_wrapped_in_rect_with_scrim(
    buffer: &mut [u32],
    rect: Rect,
    text: &str,
    color: u32,
    scale: i32,
    scrim_alpha: u8,
    max_lines: usize,
) {
    let max_lines = max_lines.max(1);
    let mut lines = wrap_text_lines(text, (rect.w - 8).max(24), scale);
    if lines.is_empty() {
        return;
    }
    if lines.len() > max_lines {
        lines.truncate(max_lines);
    }
    if let Some(last) = lines.last_mut() {
        let was_truncated = wrap_text_lines(text, (rect.w - 8).max(24), scale).len() > max_lines;
        if was_truncated {
            *last = truncate_with_ellipsis(last, (rect.w - 8).max(24), scale);
        }
    }

    let line_h = (measure_text_metrics("Ag", scale).height + 4).clamp(12, 20);
    let total_h = line_h * lines.len() as i32;
    let mut y = rect.y + ((rect.h - total_h).max(0) / 2);
    for line in lines {
        draw_text_centered_with_scrim(
            buffer,
            rect.x + (rect.w / 2),
            y - measure_text_metrics("Ag", scale).min_y,
            &line,
            color,
            scale,
            scrim_alpha,
        );
        y += line_h;
    }
}

pub fn truncate_with_ellipsis(text: &str, max_width: i32, scale: i32) -> String {
    if measure_text_width(text, scale) <= max_width {
        return text.to_string();
    }
    let mut out = text.to_string();
    while out.len() > 1 && measure_text_width(&format!("{out}..."), scale) > max_width {
        out.pop();
    }
    format!("{out}...")
}

pub fn wrap_text_lines(text: &str, max_width: i32, scale: i32) -> Vec<String> {
    let max_width = max_width.max(40);
    let mut out = Vec::new();
    for raw_line in text.lines() {
        let words = raw_line.split_whitespace().collect::<Vec<_>>();
        if words.is_empty() {
            out.push(String::new());
            continue;
        }
        let mut current = String::new();
        for word in words {
            let candidate = if current.is_empty() {
                word.to_string()
            } else {
                format!("{current} {word}")
            };
            if measure_text_width(&candidate, scale) <= max_width || current.is_empty() {
                current = candidate;
            } else {
                out.push(current);
                current = word.to_string();
            }
        }
        if !current.is_empty() {
            out.push(current);
        }
    }
    out
}

pub fn measure_text_width(text: &str, scale: i32) -> i32 {
    measure_text_metrics(text, scale).width
}

pub fn measure_text_metrics(text: &str, scale: i32) -> TextMetrics {
    if text.is_empty() {
        return TextMetrics {
            width: 0,
            min_y: 0,
            height: 0,
        };
    }
    if let Some(font) = system_font() {
        use fontdue::layout::{CoordinateSystem, Layout, LayoutSettings, TextStyle};
        let mut layout = Layout::new(CoordinateSystem::PositiveYDown);
        layout.reset(&LayoutSettings::default());
        layout.append(&[font], &TextStyle::new(text, text_px_size(scale), 0));
        let mut min_y = f32::MAX;
        let mut max_x = 0f32;
        let mut max_y = 0f32;
        for glyph in layout.glyphs() {
            let (metrics, _) = font.rasterize_config(glyph.key);
            if metrics.width == 0 || metrics.height == 0 {
                continue;
            }
            min_y = min_y.min(glyph.y);
            max_x = max_x.max(glyph.x + metrics.width as f32);
            max_y = max_y.max(glyph.y + metrics.height as f32);
        }
        let min_y = if min_y.is_finite() {
            min_y.floor() as i32
        } else {
            0
        };
        let max_y_i = if max_y.is_finite() {
            max_y.ceil() as i32
        } else {
            0
        };
        return TextMetrics {
            width: max_x.ceil() as i32,
            min_y,
            height: (max_y_i - min_y).max(0),
        };
    }
    let s = scale.max(1);
    TextMetrics {
        width: ((text.chars().count() as i32) * ((8 * s) + s)).max(0),
        min_y: 0,
        height: 8 * s,
    }
}

pub fn draw_text(buffer: &mut [u32], x: i32, y: i32, text: &str, color: u32, scale: i32) {
    let _ =
        draw_text_wrapped_internal(buffer, x, y, i32::MAX / 4, i32::MAX / 4, text, color, scale);
}

pub fn draw_text_wrapped_internal(
    buffer: &mut [u32],
    x: i32,
    y: i32,
    max_width: i32,
    max_height: i32,
    text: &str,
    color: u32,
    scale: i32,
) -> i32 {
    if let Some(font) = system_font() {
        return draw_text_system_font(
            buffer, x, y, max_width, max_height, text, color, scale, font,
        );
    }
    draw_text_bitmap_fallback(buffer, x, y, max_width, max_height, text, color, scale)
}

pub fn draw_text_system_font(
    buffer: &mut [u32],
    x: i32,
    y: i32,
    max_width: i32,
    max_height: i32,
    text: &str,
    color: u32,
    scale: i32,
    font: &Font,
) -> i32 {
    use fontdue::layout::{CoordinateSystem, Layout, LayoutSettings, TextStyle};

    let px = text_px_size(scale);
    let mut layout = Layout::new(CoordinateSystem::PositiveYDown);
    layout.reset(&LayoutSettings {
        x: 0.0,
        y: 0.0,
        max_width: if max_width > 0 {
            Some(max_width as f32)
        } else {
            None
        },
        max_height: if max_height > 0 {
            Some(max_height as f32)
        } else {
            None
        },
        ..LayoutSettings::default()
    });
    layout.append(&[font], &TextStyle::new(text, px, 0));

    let mut bottom = y;
    for glyph in layout.glyphs() {
        let gx = x + glyph.x.round() as i32;
        let gy = y + glyph.y.round() as i32;
        if gx >= WIN_W as i32 || gy >= WIN_H as i32 {
            continue;
        }
        let (metrics, bitmap) = font.rasterize_config(glyph.key);
        if metrics.width == 0 || metrics.height == 0 {
            continue;
        }
        for by in 0..metrics.height {
            let py = gy + by as i32;
            if py < 0 || py >= WIN_H as i32 {
                continue;
            }
            let row = py as usize * WIN_W;
            for bx in 0..metrics.width {
                let px_out = gx + bx as i32;
                if px_out < 0 || px_out >= WIN_W as i32 {
                    continue;
                }
                let alpha = bitmap[by * metrics.width + bx];
                if alpha == 0 {
                    continue;
                }
                let idx = row + px_out as usize;
                buffer[idx] = blend_over(buffer[idx], color, alpha);
            }
        }
        bottom = bottom.max(gy + metrics.height as i32);
    }
    bottom
}

pub fn draw_text_bitmap_fallback(
    buffer: &mut [u32],
    x: i32,
    y: i32,
    max_width: i32,
    max_height: i32,
    text: &str,
    color: u32,
    scale: i32,
) -> i32 {
    let scale = scale.max(1);
    let mut cx = x;
    let mut cy = y;
    let line_h = 9 * scale;
    let max_x = x + max_width.max(0);
    let max_y = y + max_height.max(0);
    for ch in text.chars() {
        if ch == '\n' {
            cx = x;
            cy += line_h;
            if cy >= max_y {
                break;
            }
            continue;
        }
        if cx + (8 * scale) > max_x {
            cx = x;
            cy += line_h;
            if cy >= max_y {
                break;
            }
        }
        if let Some(glyph) = BASIC_FONTS.get(ch) {
            draw_glyph_bitmap(buffer, cx, cy, glyph, color, scale);
        }
        cx += 8 * scale + scale;
    }
    cy + line_h
}

pub fn draw_glyph_bitmap(
    buffer: &mut [u32],
    x: i32,
    y: i32,
    glyph: [u8; 8],
    color: u32,
    scale: i32,
) {
    for (row_idx, row) in glyph.iter().enumerate() {
        for col in 0..8 {
            let on = (row >> col) & 1 == 1;
            if !on {
                continue;
            }
            let px = x + (col * scale);
            let py = y + (row_idx as i32 * scale);
            fill_rect(
                buffer,
                Rect {
                    x: px,
                    y: py,
                    w: scale,
                    h: scale,
                },
                color,
            );
        }
    }
}

pub fn text_px_size(scale: i32) -> f32 {
    match scale.max(1) {
        1 => 16.0,
        2 => 24.0,
        _ => 34.0,
    }
}

pub fn blend_over(dst: u32, src: u32, alpha: u8) -> u32 {
    if alpha == 255 {
        return src;
    }
    let a = alpha as u32;
    let inv = 255 - a;

    let sr = (src >> 16) & 0xff;
    let sg = (src >> 8) & 0xff;
    let sb = src & 0xff;

    let dr = (dst >> 16) & 0xff;
    let dg = (dst >> 8) & 0xff;
    let db = dst & 0xff;

    let r = (sr * a + dr * inv) / 255;
    let g = (sg * a + dg * inv) / 255;
    let b = (sb * a + db * inv) / 255;

    (r << 16) | (g << 8) | b
}

#[allow(dead_code)]
pub fn draw_gear_icon(buffer: &mut [u32], x: i32, y: i32, color: u32) {
    let points = [
        (4, 0),
        (5, 0),
        (4, 1),
        (5, 1),
        (1, 4),
        (0, 4),
        (1, 5),
        (0, 5),
        (10, 4),
        (11, 4),
        (10, 5),
        (11, 5),
        (4, 10),
        (5, 10),
        (4, 11),
        (5, 11),
    ];
    for (dx, dy) in points {
        fill_rect(
            buffer,
            Rect {
                x: x + dx,
                y: y + dy,
                w: 1,
                h: 1,
            },
            color,
        );
    }

    stroke_rect(
        buffer,
        Rect {
            x: x + 2,
            y: y + 2,
            w: 8,
            h: 8,
        },
        color,
    );
    fill_rect(
        buffer,
        Rect {
            x: x + 4,
            y: y + 4,
            w: 2,
            h: 2,
        },
        color,
    );
}
