use std::collections::VecDeque;
#[cfg(target_os = "linux")]
use std::convert::TryFrom;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::sync::{Arc, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Context};
use base64::{engine::general_purpose, Engine as _};
use font8x8::{UnicodeFonts, BASIC_FONTS};
use fontdb::{Database, Family, Query, Source, Style, Weight};
use fontdue::{Font, FontSettings};
use image::imageops::FilterType;
use minifb::{Icon, Key, MouseButton, MouseMode, Scale, Window, WindowOptions};
use luthier_orchestrator_core::doctor::{run_doctor, CheckStatus, DoctorReport};
use luthier_orchestrator_core::GameConfig;
use serde_json::Value;

use crate::overrides::{
    apply_runtime_overrides, build_feature_view, load_runtime_overrides, save_runtime_overrides,
    RuntimeOverrides,
};
use crate::payload::load_embedded_config_required;

const WIN_W: usize = 960;
const WIN_H: usize = 310;
const FPS: u64 = 60;
const PRELAUNCH_AUTOSTART_SECS: u64 = 10;

const BG: u32 = 0x000000;
const BORDER: u32 = 0x2a2a2a;
const TEXT: u32 = 0xffffff;
const MUTED: u32 = 0xbdbdbd;
const BAD: u32 = 0xffffff;
const BTN: u32 = 0x101010;
const BTN_HOVER: u32 = 0x181818;
const SEPARATOR: u32 = 0x1f1f1f;

static SYSTEM_FONT: OnceLock<Option<Font>> = OnceLock::new();
static SPLASH_LOCALE: OnceLock<SplashLocale> = OnceLock::new();
const EMBEDDED_SPLASH_FONT_BYTES: &[u8] = include_bytes!("../assets/fonts/NotoSans-Regular.ttf");

#[derive(Debug, Clone, Copy)]
struct SplashWindowScale {
    minifb_scale: Scale,
    factor: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SplashLocale {
    PtBr,
    EnUs,
}

#[derive(Debug, Clone, Copy)]
enum SplashTextKey {
    WindowTitle,
    WindowDependencies,
    StatusPreparingExecution,
    StatusPreparingEnvironment,
    StatusCreatingPrefix,
    StatusPreparingPrefixDependencies,
    StatusPrefixAlreadyConfigured,
    StatusRegistryApplied,
    StatusRegistryAlreadyConfigured,
    StatusWinecfgApplied,
    StatusWinecfgAlreadyApplied,
    StatusMountingFolders,
    StatusRunningPreparation,
    StatusLaunchingGame,
    StatusLaunchFailed,
    StatusGameClosed,
    ActionContinue,
    ActionExit,
    ActionBack,
    ActionSave,
    ScreenGame,
    ScreenConfig,
    ConfigSubtitle,
    ConfigNone,
    ToggleDefault,
    ToggleEnabled,
    ToggleDisabled,
    MissingDepsTitle,
    MissingDepsHint,
    DepOk,
    DepNotOk,
    CountdownContinuing,
    CountdownContinuingNow,
    PromptWorked,
    PromptShare,
    AnswerYes,
    AnswerNo,
    FeedbackPlaceholder,
    SpawnFailed,
}

fn active_splash_locale() -> SplashLocale {
    *SPLASH_LOCALE.get_or_init(|| resolve_splash_locale(None))
}

fn resolve_splash_locale(lang_override: Option<&str>) -> SplashLocale {
    let candidate = lang_override
        .and_then(non_empty_trimmed)
        .map(str::to_string)
        .or_else(|| std::env::var("LC_ALL").ok())
        .or_else(|| std::env::var("LC_MESSAGES").ok())
        .or_else(|| std::env::var("LANG").ok())
        .unwrap_or_else(|| "en-US".to_string());
    let normalized = candidate.replace('_', "-").to_ascii_lowercase();
    if normalized.starts_with("pt") {
        SplashLocale::PtBr
    } else {
        SplashLocale::EnUs
    }
}

fn t(key: SplashTextKey) -> &'static str {
    t_for(active_splash_locale(), key)
}

fn t_for(locale: SplashLocale, key: SplashTextKey) -> &'static str {
    match locale {
        SplashLocale::PtBr => match key {
            SplashTextKey::WindowTitle => "Luthier",
            SplashTextKey::WindowDependencies => "Dependencias",
            SplashTextKey::StatusPreparingExecution => "Preparando execucao",
            SplashTextKey::StatusPreparingEnvironment => "Preparando ambiente",
            SplashTextKey::StatusCreatingPrefix => "Criando o wineprefix",
            SplashTextKey::StatusPreparingPrefixDependencies => {
                "Preparando dependencias do prefixo"
            }
            SplashTextKey::StatusPrefixAlreadyConfigured => "Prefixo ja configurado",
            SplashTextKey::StatusRegistryApplied => "Aplicando configuracoes de registro",
            SplashTextKey::StatusRegistryAlreadyConfigured => "Registro ja configurado",
            SplashTextKey::StatusWinecfgApplied => "Aplicando configuracoes do Wine",
            SplashTextKey::StatusWinecfgAlreadyApplied => "Configuracoes do Wine ja aplicadas",
            SplashTextKey::StatusMountingFolders => "Montando pastas",
            SplashTextKey::StatusRunningPreparation => "Executando preparacao",
            SplashTextKey::StatusLaunchingGame => "Iniciando jogo...",
            SplashTextKey::StatusLaunchFailed => "Falha ao iniciar o jogo",
            SplashTextKey::StatusGameClosed => "Jogo encerrado",
            SplashTextKey::ActionContinue => "Continuar",
            SplashTextKey::ActionExit => "Sair",
            SplashTextKey::ActionBack => "Voltar",
            SplashTextKey::ActionSave => "Salvar",
            SplashTextKey::ScreenGame => "Jogo",
            SplashTextKey::ScreenConfig => "Configuracao",
            SplashTextKey::ConfigSubtitle => "Opcoes opcionais desta execucao",
            SplashTextKey::ConfigNone => "Nenhuma opcao configuravel",
            SplashTextKey::ToggleDefault => "Padrao",
            SplashTextKey::ToggleEnabled => "Ativado",
            SplashTextKey::ToggleDisabled => "Desativado",
            SplashTextKey::MissingDepsTitle => "Dependencias faltando",
            SplashTextKey::MissingDepsHint => {
                "Instale as dependencias faltantes antes de continuar"
            }
            SplashTextKey::DepOk => "ok",
            SplashTextKey::DepNotOk => "nao ok",
            SplashTextKey::CountdownContinuing => "Continuando em {n}...",
            SplashTextKey::CountdownContinuingNow => "Continuando...",
            SplashTextKey::PromptWorked => "Funcionou como deveria?",
            SplashTextKey::PromptShare => {
                "Deseja compartilhar payload e executavel com a comunidade?"
            }
            SplashTextKey::AnswerYes => "Sim",
            SplashTextKey::AnswerNo => "Nao",
            SplashTextKey::FeedbackPlaceholder => {
                "Essa etapa ainda nao envia nada. Placeholder do fluxo final."
            }
            SplashTextKey::SpawnFailed => "Falha ao iniciar",
        },
        SplashLocale::EnUs => match key {
            SplashTextKey::WindowTitle => "Luthier",
            SplashTextKey::WindowDependencies => "Dependencies",
            SplashTextKey::StatusPreparingExecution => "Preparing execution",
            SplashTextKey::StatusPreparingEnvironment => "Preparing environment",
            SplashTextKey::StatusCreatingPrefix => "Creating Wine prefix",
            SplashTextKey::StatusPreparingPrefixDependencies => "Preparing prefix dependencies",
            SplashTextKey::StatusPrefixAlreadyConfigured => "Prefix already configured",
            SplashTextKey::StatusRegistryApplied => "Applying registry configuration",
            SplashTextKey::StatusRegistryAlreadyConfigured => "Registry already configured",
            SplashTextKey::StatusWinecfgApplied => "Applying Wine configuration",
            SplashTextKey::StatusWinecfgAlreadyApplied => "Wine configuration already applied",
            SplashTextKey::StatusMountingFolders => "Mounting folders",
            SplashTextKey::StatusRunningPreparation => "Running pre-launch preparation",
            SplashTextKey::StatusLaunchingGame => "Starting game...",
            SplashTextKey::StatusLaunchFailed => "Failed to start the game",
            SplashTextKey::StatusGameClosed => "Game closed",
            SplashTextKey::ActionContinue => "Continue",
            SplashTextKey::ActionExit => "Exit",
            SplashTextKey::ActionBack => "Back",
            SplashTextKey::ActionSave => "Save",
            SplashTextKey::ScreenGame => "Game",
            SplashTextKey::ScreenConfig => "Configuration",
            SplashTextKey::ConfigSubtitle => "Optional settings for this run",
            SplashTextKey::ConfigNone => "No configurable options",
            SplashTextKey::ToggleDefault => "Default",
            SplashTextKey::ToggleEnabled => "Enabled",
            SplashTextKey::ToggleDisabled => "Disabled",
            SplashTextKey::MissingDepsTitle => "Missing dependencies",
            SplashTextKey::MissingDepsHint => "Install missing dependencies before continuing",
            SplashTextKey::DepOk => "ok",
            SplashTextKey::DepNotOk => "not ok",
            SplashTextKey::CountdownContinuing => "Continuing in {n}...",
            SplashTextKey::CountdownContinuingNow => "Continuing...",
            SplashTextKey::PromptWorked => "Did it work as expected?",
            SplashTextKey::PromptShare => "Share payload and executable with the community?",
            SplashTextKey::AnswerYes => "Yes",
            SplashTextKey::AnswerNo => "No",
            SplashTextKey::FeedbackPlaceholder => {
                "This step does not send anything yet. Placeholder for the final flow."
            }
            SplashTextKey::SpawnFailed => "Launch failed",
        },
    }
}

fn t_countdown(n: i32) -> String {
    t(SplashTextKey::CountdownContinuing).replace("{n}", &n.to_string())
}

fn t_installing_winetricks(verbs: &str) -> String {
    match active_splash_locale() {
        SplashLocale::PtBr => {
            if verbs.trim().is_empty() {
                "Instalando winetricks".to_string()
            } else {
                format!("Instalando winetricks: {verbs}")
            }
        }
        SplashLocale::EnUs => {
            if verbs.trim().is_empty() {
                "Installing winetricks".to_string()
            } else {
                format!("Installing winetricks: {verbs}")
            }
        }
    }
}

fn t_process_exit(code: Option<i32>) -> String {
    match active_splash_locale() {
        SplashLocale::PtBr => format!(
            "Processo encerrado com codigo {}",
            code.map(|v| v.to_string())
                .unwrap_or_else(|| "desconhecido".to_string())
        ),
        SplashLocale::EnUs => format!(
            "Process exited with code {}",
            code.map(|v| v.to_string())
                .unwrap_or_else(|| "unknown".to_string())
        ),
    }
}

fn non_empty_trimmed(raw: &str) -> Option<&str> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

#[derive(Debug, Clone, Copy)]
pub enum SplashLaunchMode {
    ImplicitDoubleClick,
    ExplicitPlayWithSplash,
}

#[derive(Debug, Clone)]
struct ToggleRow {
    key: &'static str,
    label: &'static str,
    value: Option<bool>,
}

#[derive(Debug, Clone)]
struct HeroBackground {
    pixels: Vec<u32>,
}

#[derive(Debug, Clone)]
struct PrelaunchState {
    config: GameConfig,
    overrides: RuntimeOverrides,
    doctor: DoctorReport,
    countdown_started_at: Instant,
    configurable_rows: Vec<ToggleRow>,
    hero_background: Option<Arc<HeroBackground>>,
}

enum PrelaunchDecision {
    Start {
        overrides: RuntimeOverrides,
        window: Window,
        buffer: Vec<u32>,
    },
    Exit,
}

#[derive(Debug)]
enum FeedbackDecision {
    Close,
}

#[derive(Debug)]
struct ChildRunOutcome {
    game_name: String,
    hero_background: Option<Arc<HeroBackground>>,
}

#[derive(Debug)]
enum ChildStream {
    Stdout,
    Stderr,
}

#[derive(Debug)]
enum ChildEvent {
    Line(ChildStream, String),
    Exited(Option<i32>),
}

#[derive(Debug, Clone)]
struct ProgressViewState {
    game_name: String,
    hero_background: Option<Arc<HeroBackground>>,
    status: String,
    started_at: Instant,
    launching_started_at: Option<Instant>,
    game_runtime_start_seen: bool,
    game_command_started: bool,
    recent_messages: VecDeque<String>,
    exit_code: Option<i32>,
    child_finished: bool,
    child_failed_to_spawn: Option<String>,
}

impl ProgressViewState {
    fn new(game_name: String, hero_background: Option<Arc<HeroBackground>>) -> Self {
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

    fn set_status(&mut self, text: impl Into<String>) {
        let text = text.into();
        if self.status != text {
            self.status = text.clone();
            self.push_message(text);
        }
    }

    fn push_message(&mut self, text: String) {
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
struct Rect {
    x: i32,
    y: i32,
    w: i32,
    h: i32,
}

#[derive(Debug, Clone, Copy)]
struct TextMetrics {
    width: i32,
    min_y: i32,
    height: i32,
}

impl Rect {
    fn contains(&self, px: i32, py: i32) -> bool {
        px >= self.x && py >= self.y && px < self.x + self.w && py < self.y + self.h
    }
}

#[derive(Debug, Clone, Copy)]
struct MouseSnapshot {
    x: i32,
    y: i32,
    left_down: bool,
    left_pressed: bool,
}

pub fn run_splash_flow(mode: SplashLaunchMode, lang_override: Option<&str>) -> anyhow::Result<()> {
    let _ = SPLASH_LOCALE.set(resolve_splash_locale(lang_override));
    let mut config =
        load_embedded_config_required().context("embedded payload is required for splash mode")?;
    let hero_background = decode_hero_background_from_config(&config)
        .ok()
        .flatten()
        .map(Arc::new);
    let overrides =
        load_runtime_overrides(&config.exe_hash).unwrap_or_else(|_| RuntimeOverrides::default());
    apply_runtime_overrides(&mut config, &overrides);

    let doctor = run_doctor(Some(&config));
    if matches!(doctor.summary, CheckStatus::BLOCKER) {
        show_doctor_block_window(&config, &doctor, hero_background.as_ref())?;
        return Ok(());
    }

    let mut prelaunch = PrelaunchState {
        configurable_rows: build_toggle_rows(&config, &overrides),
        config,
        overrides,
        doctor,
        countdown_started_at: Instant::now(),
        hero_background: hero_background.clone(),
    };

    match show_prelaunch_window(&mut prelaunch, mode)? {
        PrelaunchDecision::Exit => Ok(()),
        PrelaunchDecision::Start {
            overrides,
            window,
            buffer,
        } => {
            let outcome = show_runtime_progress_window(
                window,
                buffer,
                &prelaunch.config.game_name,
                prelaunch.hero_background.clone(),
            )?;
            let _ = show_post_game_feedback_window(outcome);
            // Refresh/save not needed here; overrides are already persisted in config screen.
            let _ = overrides;
            Ok(())
        }
    }
}

fn build_toggle_rows(config: &GameConfig, overrides: &RuntimeOverrides) -> Vec<ToggleRow> {
    let mut rows = Vec::new();
    if matches!(
        config.environment.gamescope.state,
        luthier_orchestrator_core::FeatureState::OptionalOn
    ) {
        push_optional_toggle_row(
            &mut rows,
            "gamescope",
            "Gamescope",
            config.environment.gamescope.state,
            overrides.gamescope,
        );
    }
    push_optional_toggle_row(
        &mut rows,
        "mangohud",
        "MangoHud",
        config.requirements.mangohud,
        overrides.mangohud,
    );
    push_optional_toggle_row(
        &mut rows,
        "gamemode",
        "GameMode",
        config.requirements.gamemode,
        overrides.gamemode,
    );
    push_optional_toggle_row(
        &mut rows,
        "prime_offload",
        "Prime Offload",
        config.environment.prime_offload,
        overrides.prime_offload,
    );
    push_optional_toggle_row(
        &mut rows,
        "wine_wayland",
        "Wine-Wayland",
        config.compatibility.wine_wayland,
        overrides.wine_wayland,
    );
    push_optional_toggle_row(
        &mut rows,
        "hdr",
        "HDR",
        config.compatibility.hdr,
        overrides.hdr,
    );
    push_optional_toggle_row(
        &mut rows,
        "auto_dxvk_nvapi",
        "DXVK-NVAPI",
        config.compatibility.auto_dxvk_nvapi,
        overrides.auto_dxvk_nvapi,
    );
    push_optional_toggle_row(
        &mut rows,
        "easy_anti_cheat_runtime",
        "EAC Runtime",
        config.compatibility.easy_anti_cheat_runtime,
        overrides.easy_anti_cheat_runtime,
    );
    push_optional_toggle_row(
        &mut rows,
        "battleye_runtime",
        "BattlEye Runtime",
        config.compatibility.battleye_runtime,
        overrides.battleye_runtime,
    );
    push_optional_toggle_row(
        &mut rows,
        "umu",
        "UMU",
        config.requirements.umu,
        overrides.umu,
    );
    rows
}

fn push_optional_toggle_row(
    rows: &mut Vec<ToggleRow>,
    key: &'static str,
    label: &'static str,
    state: luthier_orchestrator_core::FeatureState,
    value: Option<bool>,
) {
    let view = build_feature_view(key, state, value);
    if view.overridable {
        rows.push(ToggleRow { key, label, value });
    }
}

fn show_prelaunch_window(
    state: &mut PrelaunchState,
    mode: SplashLaunchMode,
) -> anyhow::Result<PrelaunchDecision> {
    let mut window = create_window(t(SplashTextKey::WindowTitle))?;
    let mut buffer = vec![0u32; WIN_W * WIN_H];
    let mut last_left_down = false;
    let mut config_open = false;
    let mut config_working = state.overrides.clone();
    let mut config_rows = build_toggle_rows(&state.config, &config_working);

    // Autostart countdown for splash mode.
    state.countdown_started_at = Instant::now();

    loop {
        if !window.is_open() {
            return Ok(PrelaunchDecision::Exit);
        }

        let mouse = read_mouse(&window, last_left_down);
        last_left_down = mouse.left_down;

        if window.is_key_down(Key::Escape) {
            if config_open {
                config_open = false;
                state.countdown_started_at = Instant::now();
                continue;
            }
            return Ok(PrelaunchDecision::Exit);
        }

        let elapsed = state.countdown_started_at.elapsed();
        let countdown_left = if elapsed >= Duration::from_secs(PRELAUNCH_AUTOSTART_SECS) {
            0
        } else {
            PRELAUNCH_AUTOSTART_SECS as i32 - elapsed.as_secs() as i32
        };

        let gear_visible = !state.configurable_rows.is_empty();
        let gear_button = Rect {
            x: WIN_W as i32 - 154,
            y: 20,
            w: 132,
            h: 28,
        };
        let start_button = Rect {
            x: WIN_W as i32 - 134,
            y: WIN_H as i32 - 50,
            w: 104,
            h: 28,
        };
        let exit_button = Rect {
            x: 30,
            y: WIN_H as i32 - 50,
            w: 84,
            h: 28,
        };

        if config_open {
            let save_button = Rect {
                x: WIN_W as i32 - 126,
                y: WIN_H as i32 - 50,
                w: 96,
                h: 28,
            };
            let cancel_button = Rect {
                x: 30,
                y: WIN_H as i32 - 50,
                w: 96,
                h: 28,
            };

            let row_buttons = config_toggle_button_rects(config_rows.len());

            if mouse.left_pressed && cancel_button.contains(mouse.x, mouse.y) {
                config_open = false;
                config_working = state.overrides.clone();
                config_rows = build_toggle_rows(&state.config, &config_working);
                state.countdown_started_at = Instant::now();
            } else if mouse.left_pressed && save_button.contains(mouse.x, mouse.y) {
                save_runtime_overrides(&state.config.exe_hash, &config_working)
                    .context("failed to save runtime overrides from splash")?;
                state.overrides = config_working.clone();
                let mut fresh = load_embedded_config_required()?;
                apply_runtime_overrides(&mut fresh, &state.overrides);
                state.doctor = run_doctor(Some(&fresh));
                state.config = fresh;
                state.configurable_rows = build_toggle_rows(&state.config, &state.overrides);
                config_rows = state.configurable_rows.clone();
                config_open = false;
                state.countdown_started_at = Instant::now();
                if matches!(state.doctor.summary, CheckStatus::BLOCKER) {
                    show_doctor_block_window(
                        &state.config,
                        &state.doctor,
                        state.hero_background.as_ref(),
                    )?;
                    return Ok(PrelaunchDecision::Exit);
                }
            } else {
                for (idx, button) in row_buttons.iter().enumerate() {
                    if mouse.left_pressed && button.contains(mouse.x, mouse.y) {
                        cycle_override_for_key(&mut config_working, config_rows[idx].key);
                        config_rows = build_toggle_rows(&state.config, &config_working);
                        break;
                    }
                }
            }

            draw_config(
                &mut buffer,
                &window,
                &config_rows,
                save_button,
                cancel_button,
                &mouse,
                state.hero_background.as_deref(),
            );
            window
                .update_with_buffer(&buffer, WIN_W, WIN_H)
                .context("failed to present splash config frame")?;
            thread::sleep(Duration::from_millis(1000 / FPS));
            continue;
        }

        if gear_visible && mouse.left_pressed && gear_button.contains(mouse.x, mouse.y) {
            config_open = true;
            config_working = state.overrides.clone();
            config_rows = build_toggle_rows(&state.config, &config_working);
            continue;
        }

        if mouse.left_pressed && exit_button.contains(mouse.x, mouse.y) {
            return Ok(PrelaunchDecision::Exit);
        }

        let auto_start_ready = elapsed >= Duration::from_secs(PRELAUNCH_AUTOSTART_SECS);
        if auto_start_ready || (mouse.left_pressed && start_button.contains(mouse.x, mouse.y)) {
            return Ok(PrelaunchDecision::Start {
                overrides: state.overrides.clone(),
                window,
                buffer,
            });
        }

        draw_prelaunch(
            &mut buffer,
            &window,
            state,
            countdown_left.max(0),
            gear_visible,
            gear_button,
            start_button,
            exit_button,
            mode,
            mouse,
            state.hero_background.as_deref(),
        );
        window
            .update_with_buffer(&buffer, WIN_W, WIN_H)
            .context("failed to present splash prelaunch frame")?;
        thread::sleep(Duration::from_millis(1000 / FPS));
    }
}

fn cycle_override_for_key(overrides: &mut RuntimeOverrides, key: &str) {
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

fn show_doctor_block_window(
    config: &GameConfig,
    report: &DoctorReport,
    hero_background: Option<&Arc<HeroBackground>>,
) -> anyhow::Result<()> {
    let mut window = create_window(t(SplashTextKey::WindowDependencies))?;
    let mut buffer = vec![0u32; WIN_W * WIN_H];
    let mut last_left_down = false;

    let items = build_doctor_block_items(config, report);

    loop {
        if !window.is_open() || window.is_key_down(Key::Escape) {
            return Ok(());
        }

        let mouse = read_mouse(&window, last_left_down);
        last_left_down = mouse.left_down;
        let exit_button = Rect {
            x: (WIN_W as i32 / 2) - 70,
            y: WIN_H as i32 - 64,
            w: 140,
            h: 36,
        };

        if mouse.left_pressed && exit_button.contains(mouse.x, mouse.y) {
            return Ok(());
        }

        draw_doctor_block(
            &mut buffer,
            &window,
            &items,
            exit_button,
            &mouse,
            hero_background.map(Arc::as_ref),
        );
        window
            .update_with_buffer(&buffer, WIN_W, WIN_H)
            .context("failed to present doctor blocker splash")?;
        thread::sleep(Duration::from_millis(1000 / FPS));
    }
}

fn build_doctor_block_items(config: &GameConfig, report: &DoctorReport) -> Vec<(String, bool)> {
    let mut out = Vec::new();

    let runtime_ok = !matches!(report.runtime.runtime_status, CheckStatus::BLOCKER);
    let proton_label = if config.runner.proton_version.trim().is_empty() {
        "proton".to_string()
    } else {
        config.runner.proton_version.trim().to_lowercase()
    };
    out.push((proton_label, runtime_ok));

    for dep in &report.dependencies {
        let ok = matches!(dep.status, CheckStatus::OK | CheckStatus::INFO);
        out.push((dep.name.clone(), ok));
    }

    out
}

fn show_runtime_progress_window(
    mut window: Window,
    mut buffer: Vec<u32>,
    game_name: &str,
    hero_background: Option<Arc<HeroBackground>>,
) -> anyhow::Result<ChildRunOutcome> {
    let (tx, rx) = mpsc::channel::<ChildEvent>();
    spawn_play_child(tx)?;
    let mut last_left_down = false;
    let mut progress = ProgressViewState::new(game_name.to_string(), hero_background.clone());

    loop {
        while let Ok(event) = rx.try_recv() {
            handle_child_event(&mut progress, event);
        }

        if progress.game_command_started && progress.launching_started_at.is_none() {
            progress.launching_started_at = Some(Instant::now());
            progress.set_status(t(SplashTextKey::StatusLaunchingGame));
        }

        let min_launch_elapsed = progress
            .launching_started_at
            .map(|t| t.elapsed() >= Duration::from_secs(3))
            .unwrap_or(false);

        if progress.game_runtime_start_seen && min_launch_elapsed {
            window.update();
            break;
        }

        if progress.child_finished && progress.launching_started_at.is_none() {
            // Failed before launch start; keep window for a short visual message.
            progress.set_status(t(SplashTextKey::StatusLaunchFailed));
        }

        if progress.child_finished
            && progress.launching_started_at.is_some()
            && !progress.game_runtime_start_seen
        {
            // Game process ended before we saw a startup heuristic; stop waiting after minimum.
            if min_launch_elapsed {
                break;
            }
        }

        if !window.is_open() || window.is_key_down(Key::Escape) {
            break;
        }

        let mouse = read_mouse(&window, last_left_down);
        last_left_down = mouse.left_down;
        draw_progress(&mut buffer, &window, &progress, &mouse);
        window
            .update_with_buffer(&buffer, WIN_W, WIN_H)
            .context("failed to present splash progress")?;
        thread::sleep(Duration::from_millis(1000 / FPS));
    }

    // Drop the window before waiting for process termination, otherwise some WMs/compositors
    // may show it as "not responding" while we intentionally stop presenting frames.
    drop(window);

    // Wait for child exit if it is still running; keep draining events.
    let wait_start = Instant::now();
    while !progress.child_finished && wait_start.elapsed() < Duration::from_secs(24 * 60 * 60) {
        match rx.recv_timeout(Duration::from_millis(50)) {
            Ok(event) => handle_child_event(&mut progress, event),
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }

    Ok(ChildRunOutcome {
        game_name: game_name.to_string(),
        hero_background,
    })
}

fn spawn_play_child(tx: mpsc::Sender<ChildEvent>) -> anyhow::Result<()> {
    let current_exe = std::env::current_exe().context("failed to locate current executable")?;
    let mut child = Command::new(&current_exe)
        .arg("--play")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .with_context(|| format!("failed to spawn '{}' --play", current_exe.display()))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    if let Some(stdout) = stdout {
        let tx_out = tx.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        let _ = tx_out.send(ChildEvent::Line(ChildStream::Stdout, line));
                    }
                    Err(err) => {
                        let _ = tx_out.send(ChildEvent::Line(
                            ChildStream::Stdout,
                            format!("(stdout read error: {err})"),
                        ));
                        break;
                    }
                }
            }
        });
    }

    if let Some(stderr) = stderr {
        let tx_err = tx.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        let _ = tx_err.send(ChildEvent::Line(ChildStream::Stderr, line));
                    }
                    Err(err) => {
                        let _ = tx_err.send(ChildEvent::Line(
                            ChildStream::Stderr,
                            format!("(stderr read error: {err})"),
                        ));
                        break;
                    }
                }
            }
        });
    }

    thread::spawn(move || {
        let code = child.wait().ok().and_then(|status| status.code());
        let _ = tx.send(ChildEvent::Exited(code));
    });

    Ok(())
}

fn handle_child_event(progress: &mut ProgressViewState, event: ChildEvent) {
    match event {
        ChildEvent::Exited(code) => {
            progress.exit_code = code;
            progress.child_finished = true;
            if code == Some(0) {
                progress.push_message(t(SplashTextKey::StatusGameClosed).to_string());
            } else {
                progress.push_message(t_process_exit(code));
            }
        }
        ChildEvent::Line(stream, line) => {
            if let Some(event) = parse_ndjson_event(&line) {
                apply_progress_from_log_event(progress, &event);
                return;
            }

            match stream {
                ChildStream::Stdout | ChildStream::Stderr => {
                    if let Some(msg) = map_external_runtime_line_to_status(&line) {
                        progress.set_status(msg);
                    }
                    if line.contains("Starting program with command-launcher service.") {
                        progress.game_runtime_start_seen = true;
                    }
                }
            }
        }
    }
}

fn parse_ndjson_event(line: &str) -> Option<Value> {
    if !line.starts_with('{') || !line.contains("\"event_code\"") {
        return None;
    }
    serde_json::from_str::<Value>(line).ok()
}

fn apply_progress_from_log_event(progress: &mut ProgressViewState, event: &Value) {
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

fn map_external_runtime_line_to_status(line: &str) -> Option<String> {
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

fn show_post_game_feedback_window(outcome: ChildRunOutcome) -> anyhow::Result<FeedbackDecision> {
    let title = if outcome.game_name.trim().is_empty() {
        t(SplashTextKey::WindowTitle)
    } else {
        outcome.game_name.trim()
    };
    let mut window = create_window(title)?;
    let mut buffer = vec![0u32; WIN_W * WIN_H];
    let mut last_left_down = false;

    let mut question = 1;

    loop {
        if !window.is_open() || window.is_key_down(Key::Escape) {
            return Ok(FeedbackDecision::Close);
        }

        let mouse = read_mouse(&window, last_left_down);
        last_left_down = mouse.left_down;

        let left = Rect {
            x: (WIN_W as i32 / 2) - 120,
            y: WIN_H as i32 - 58,
            w: 104,
            h: 28,
        };
        let right = Rect {
            x: (WIN_W as i32 / 2) + 16,
            y: WIN_H as i32 - 58,
            w: 104,
            h: 28,
        };

        if mouse.left_pressed && left.contains(mouse.x, mouse.y) {
            if question == 1 {
                question = 2;
            } else {
                return Ok(FeedbackDecision::Close);
            }
        }
        if mouse.left_pressed && right.contains(mouse.x, mouse.y) {
            return Ok(FeedbackDecision::Close);
        }

        draw_feedback(
            &mut buffer,
            &window,
            &outcome,
            question,
            left,
            right,
            &mouse,
        );
        window
            .update_with_buffer(&buffer, WIN_W, WIN_H)
            .context("failed to present post-game feedback splash")?;
        thread::sleep(Duration::from_millis(1000 / FPS));
    }
}

fn decode_hero_background_from_config(
    config: &GameConfig,
) -> anyhow::Result<Option<HeroBackground>> {
    let raw = config.splash.hero_image_data_url.trim();
    if raw.is_empty() {
        return Ok(None);
    }

    let payload = raw
        .split_once("base64,")
        .map(|(_, payload)| payload.trim())
        .ok_or_else(|| anyhow!("unsupported hero image data URL format"))?;
    let bytes = general_purpose::STANDARD
        .decode(payload)
        .context("failed to decode embedded hero image data URL")?;

    let decoded =
        image::load_from_memory(&bytes).context("failed to decode embedded hero image")?;
    let resized = decoded.resize_exact(WIN_W as u32, WIN_H as u32, FilterType::Triangle);
    let rgba = resized.to_rgba8();

    let mut pixels = Vec::with_capacity(WIN_W * WIN_H);
    for px in rgba.chunks_exact(4) {
        let r = px[0] as u32;
        let g = px[1] as u32;
        let b = px[2] as u32;
        let a = px[3];
        let src = (r << 16) | (g << 8) | b;
        pixels.push(blend_over(BG, src, a));
    }

    Ok(Some(HeroBackground { pixels }))
}

fn create_window(title: &str) -> anyhow::Result<Window> {
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
    let _ = window.set_target_fps(FPS as usize);
    Ok(window)
}

fn try_set_window_icon_from_sidecar(window: &mut Window) -> anyhow::Result<()> {
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

fn try_center_window(window: &mut Window, scale_factor: i32) -> anyhow::Result<()> {
    let screen = detect_screen_size().unwrap_or((1280, 720));
    let physical_w = (WIN_W as i32 * scale_factor.max(1)).max(1);
    let physical_h = (WIN_H as i32 * scale_factor.max(1)).max(1);
    let x = ((screen.0 as i32 - physical_w) / 2).max(0);
    let y = ((screen.1 as i32 - physical_h) / 2).max(0);
    window.set_position(x as isize, y as isize);
    Ok(())
}

fn choose_splash_window_scale(screen: (usize, usize)) -> SplashWindowScale {
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

fn detect_screen_size() -> Option<(usize, usize)> {
    // Best-effort only. If unavailable, the window still opens with the WM default placement.
    // On Wayland, many compositors ignore client positioning entirely even if we know the size.
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

fn read_mouse(window: &Window, last_left_down: bool) -> MouseSnapshot {
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

fn draw_splash_background(buffer: &mut [u32], hero_background: Option<&HeroBackground>) {
    draw_splash_background_with_options(buffer, hero_background, true);
}

fn draw_splash_background_without_center_scrim(
    buffer: &mut [u32],
    hero_background: Option<&HeroBackground>,
) {
    draw_splash_background_with_options(buffer, hero_background, false);
}

fn draw_splash_background_with_options(
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
            // Extra darkening behind central content for contrast on bright images.
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

fn draw_prelaunch(
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

    let countdown = if countdown_left > 0 {
        t_countdown(countdown_left)
    } else {
        t(SplashTextKey::CountdownContinuingNow).to_string()
    };
    draw_text_centered_with_scrim(buffer, WIN_W as i32 / 2, 146, &countdown, TEXT, 1, 56);

    if gear_visible {
        draw_button_secondary_clean(buffer, gear_button, gear_button.contains(mouse.x, mouse.y));
        draw_button_label_centered(
            buffer,
            gear_button,
            t(SplashTextKey::ScreenConfig),
            TEXT,
            1,
        );
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

fn draw_config(
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

fn draw_doctor_block(
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

fn draw_progress(
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

fn draw_feedback(
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

fn clear(buffer: &mut [u32], color: u32) {
    buffer.fill(color);
}

fn fill_rect(buffer: &mut [u32], rect: Rect, color: u32) {
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

fn fill_rect_alpha(buffer: &mut [u32], rect: Rect, color: u32, alpha: u8) {
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

fn stroke_rect(buffer: &mut [u32], rect: Rect, color: u32) {
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

fn draw_button(buffer: &mut [u32], rect: Rect, fill: u32, border: u32) {
    fill_rect(buffer, rect, fill);
    stroke_rect(buffer, rect, border);
}

fn stroke_rect_alpha(buffer: &mut [u32], rect: Rect, color: u32, alpha: u8) {
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

fn draw_button_secondary_clean(buffer: &mut [u32], rect: Rect, hovered: bool) {
    draw_soft_scrim_rect(buffer, rect, 0x000000, if hovered { 74 } else { 54 }, 8);
    fill_rect_alpha(buffer, rect, 0x000000, if hovered { 118 } else { 88 });
    stroke_rect_alpha(buffer, rect, 0xffffff, if hovered { 42 } else { 20 });
}

fn draw_button_primary_clean(buffer: &mut [u32], rect: Rect, hovered: bool) {
    draw_soft_scrim_rect(buffer, rect, 0x000000, if hovered { 82 } else { 60 }, 9);
    fill_rect_alpha(buffer, rect, 0xffffff, if hovered { 56 } else { 40 });
    stroke_rect_alpha(buffer, rect, 0xffffff, if hovered { 78 } else { 52 });
}

fn config_toggle_layout(count: usize) -> Vec<(Rect, Rect)> {
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
    let rows = ((count + cols - 1) / cols) as i32;
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
            y: y + if cols >= 4 { 18 } else { 18 },
            w: btn_w,
            h: button_h,
        };
        out.push((label, button));
    }
    out
}

fn config_toggle_button_rects(count: usize) -> Vec<Rect> {
    config_toggle_layout(count)
        .into_iter()
        .map(|(_, button)| button)
        .collect()
}

fn draw_button_label_centered(buffer: &mut [u32], rect: Rect, text: &str, color: u32, scale: i32) {
    let metrics = measure_text_metrics(text, scale);
    let x = rect.x + ((rect.w - metrics.width) / 2).max(4);
    // `draw_text` uses a y origin above the actual glyph top (fontdue layout offset),
    // so compensate using the measured glyph min_y to visually center in the rect.
    let y = rect.y + ((rect.h - metrics.height) / 2) - metrics.min_y;
    draw_text(buffer, x, y, text, color, scale);
}

fn draw_text_centered_with_scrim(
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

fn draw_title_centered_fit_with_scrim(
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

fn draw_text_soft_scrim(buffer: &mut [u32], x: i32, y: i32, metrics: &TextMetrics, alpha: u8) {
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

fn draw_soft_scrim_rect(buffer: &mut [u32], rect: Rect, color: u32, core_alpha: u8, fade_px: i32) {
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

fn draw_text_centered_wrapped_in_rect_with_scrim(
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

fn truncate_with_ellipsis(text: &str, max_width: i32, scale: i32) -> String {
    if measure_text_width(text, scale) <= max_width {
        return text.to_string();
    }
    let mut out = text.to_string();
    while out.len() > 1 && measure_text_width(&format!("{out}..."), scale) > max_width {
        out.pop();
    }
    format!("{out}...")
}

fn wrap_text_lines(text: &str, max_width: i32, scale: i32) -> Vec<String> {
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

fn measure_text_width(text: &str, scale: i32) -> i32 {
    measure_text_metrics(text, scale).width
}

fn measure_text_metrics(text: &str, scale: i32) -> TextMetrics {
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

fn draw_text(buffer: &mut [u32], x: i32, y: i32, text: &str, color: u32, scale: i32) {
    let _ =
        draw_text_wrapped_internal(buffer, x, y, i32::MAX / 4, i32::MAX / 4, text, color, scale);
}

fn draw_text_wrapped_internal(
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

fn draw_text_system_font(
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

fn draw_text_bitmap_fallback(
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

fn draw_glyph_bitmap(buffer: &mut [u32], x: i32, y: i32, glyph: [u8; 8], color: u32, scale: i32) {
    for (row_idx, row) in glyph.iter().enumerate() {
        for col in 0..8 {
            let on = (row >> col) & 1 == 1;
            if !on {
                continue;
            }
            let px = x + (col as i32 * scale);
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

fn text_px_size(scale: i32) -> f32 {
    match scale.max(1) {
        1 => 16.0,
        2 => 24.0,
        _ => 34.0,
    }
}

fn system_font() -> Option<&'static Font> {
    SYSTEM_FONT
        .get_or_init(|| load_embedded_splash_font().or_else(load_system_font))
        .as_ref()
}

fn load_embedded_splash_font() -> Option<Font> {
    Font::from_bytes(EMBEDDED_SPLASH_FONT_BYTES, FontSettings::default()).ok()
}

fn load_system_font() -> Option<Font> {
    let mut db = Database::new();
    db.load_system_fonts();
    let families = [
        Family::Name("Noto Sans"),
        Family::Name("Cantarell"),
        Family::Name("DejaVu Sans"),
        Family::Name("Liberation Sans"),
        Family::SansSerif,
    ];
    let query = Query {
        families: &families,
        weight: Weight::NORMAL,
        style: Style::Normal,
        ..Query::default()
    };
    let id = db.query(&query)?;
    let face = db.face(id)?;

    let bytes = match &face.source {
        Source::Binary(data) => data.as_ref().as_ref().to_vec(),
        Source::File(path) => std::fs::read(path).ok()?,
        Source::SharedFile(path, _) => std::fs::read(path).ok()?,
    };

    Font::from_bytes(bytes, FontSettings::default()).ok()
}

fn blend_over(dst: u32, src: u32, alpha: u8) -> u32 {
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
fn draw_gear_icon(buffer: &mut [u32], x: i32, y: i32, color: u32) {
    // Minimal 12x12 "gear-like" sprite.
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
