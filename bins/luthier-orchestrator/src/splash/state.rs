use std::collections::VecDeque;
use std::sync::Arc;
use std::time::Instant;
use minifb::Window;
use luthier_orchestrator_core::doctor::DoctorReport;
use luthier_orchestrator_core::GameConfig;

use crate::application::runtime_overrides::RuntimeOverrides;
use crate::splash::{t, SplashTextKey};

#[derive(Debug, Clone, Copy)]
pub enum SplashLaunchMode {
    ImplicitDoubleClick,
    ExplicitPlayWithSplash,
}

#[derive(Debug, Clone)]
pub struct ToggleRow {
    pub key: &'static str,
    pub label: &'static str,
    pub value: Option<bool>,
}

#[derive(Debug, Clone)]
pub struct HeroBackground {
    pub pixels: Vec<u32>,
}

#[derive(Debug, Clone)]
pub struct PrelaunchState {
    pub config: GameConfig,
    pub overrides: RuntimeOverrides,
    pub doctor: DoctorReport,
    pub countdown_started_at: Instant,
    pub configurable_rows: Vec<ToggleRow>,
    pub hero_background: Option<Arc<HeroBackground>>,
}

pub enum PrelaunchDecision {
    Start {
        overrides: RuntimeOverrides,
        window: Window,
        buffer: Vec<u32>,
    },
    Exit,
}

#[derive(Debug)]
pub enum FeedbackDecision {
    Close,
}

#[derive(Debug)]
pub struct ChildRunOutcome {
    pub game_name: String,
    pub hero_background: Option<Arc<HeroBackground>>,
}

#[derive(Debug)]
pub enum ChildStream {
    Stdout,
    Stderr,
}

#[derive(Debug)]
pub enum ChildEvent {
    Line(ChildStream, String),
    Exited(Option<i32>),
}

#[derive(Debug, Clone)]
pub struct ProgressViewState {
    pub game_name: String,
    pub hero_background: Option<Arc<HeroBackground>>,
    pub status: String,
    pub started_at: Instant,
    pub launching_started_at: Option<Instant>,
    pub game_runtime_start_seen: bool,
    pub game_command_started: bool,
    pub recent_messages: VecDeque<String>,
    pub exit_code: Option<i32>,
    pub child_finished: bool,
    pub child_failed_to_spawn: Option<String>,
}

impl ProgressViewState {
    pub fn new(game_name: String, hero_background: Option<Arc<HeroBackground>>) -> Self {
        let mut s = Self {
            game_name,
            hero_background,
            status: t(SplashTextKey::StatusPreparingExecution).to_string(),
            started_at: Instant::now(),
            launching_started_at: None,
            game_runtime_start_seen: false,
            game_command_started: false,
            recent_messages: VecDeque::with_capacity(3),
            exit_code: None,
            child_finished: false,
            child_failed_to_spawn: None,
        };
        s.push_message(t(SplashTextKey::StatusPreparingExecution).to_string());
        s
    }

    pub fn set_status(&mut self, text: impl Into<String>) {
        let text = text.into();
        if self.status != text {
            self.status = text.clone();
            self.push_message(text);
        }
    }

    pub fn push_message(&mut self, text: String) {
        if self
            .recent_messages
            .back()
            .map(|v| v == &text)
            .unwrap_or(false)
        {
            return;
        }
        if self.recent_messages.iter().any(|v| v == &text) {
            return;
        }
        if self.recent_messages.len() >= 3 {
            self.recent_messages.pop_front();
        }
        self.recent_messages.push_back(text);
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

#[derive(Debug, Clone, Copy)]
pub struct TextMetrics {
    pub width: i32,
    pub min_y: i32,
    pub height: i32,
}

impl Rect {
    pub fn contains(&self, px: i32, py: i32) -> bool {
        px >= self.x && py >= self.y && px < self.x + self.w && py < self.y + self.h
    }
}

#[derive(Debug, Clone, Copy)]
pub struct MouseSnapshot {
    pub x: i32,
    pub y: i32,
    pub left_down: bool,
    pub left_pressed: bool,
}
