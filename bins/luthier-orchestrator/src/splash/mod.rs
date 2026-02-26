
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
use fontdue::Font;
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

pub mod renderer;
pub mod theme;
pub mod state;
use theme::*;
pub use state::*;
use renderer::*;

static SPLASH_LOCALE: OnceLock<SplashLocale> = OnceLock::new();

#[derive(Debug, Clone, Copy)]
pub(crate) struct SplashWindowScale {
    pub minifb_scale: Scale,
    pub factor: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SplashLocale {
    PtBr,
    EnUs,
}

#[derive(Debug, Clone, Copy)]
pub(crate) enum SplashTextKey {
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

pub(crate) fn t(key: SplashTextKey) -> &'static str {
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

