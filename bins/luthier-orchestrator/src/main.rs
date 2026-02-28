#![cfg_attr(test, allow(clippy::expect_used, clippy::unwrap_used))]

mod application;
mod cli;
mod commands;
mod domain;
mod infrastructure;
mod instance_lock;
mod logging;
mod services;
mod splash;

use anyhow::Context;
use clap::Parser;
use luthier_orchestrator_core::observability::{new_trace_id, LogLevel};

use crate::cli::Cli;
use crate::commands::{
    run_config_command, run_doctor_command, run_play, run_save_payload_command,
    run_show_payload_command, run_winecfg_command,
};
use crate::infrastructure::payload_loader::try_load_embedded_config;
use crate::logging::log_event;
use crate::splash::{run_splash_flow, SplashLaunchMode};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let trace_id = new_trace_id();

    if should_log_startup_event(&cli) {
        log_startup_event(&trace_id, &cli);
    }

    if route_explicit_commands(&trace_id, &cli)? {
        return Ok(());
    }

    if route_implicit_splash(&cli)? {
        return Ok(());
    }

    print_noop_hint();
    Ok(())
}

fn has_config_override_flags(cli: &Cli) -> bool {
    cli.set_mangohud.is_some()
        || cli.set_gamescope.is_some()
        || cli.set_gamemode.is_some()
        || cli.set_umu.is_some()
        || cli.set_winetricks.is_some()
        || cli.set_steam_runtime.is_some()
        || cli.set_prime_offload.is_some()
        || cli.set_wine_wayland.is_some()
        || cli.set_hdr.is_some()
        || cli.set_auto_dxvk_nvapi.is_some()
        || cli.set_easy_anti_cheat_runtime.is_some()
        || cli.set_battleye_runtime.is_some()
}

fn log_startup_event(trace_id: &str, cli: &Cli) {
    log_event(
        trace_id,
        LogLevel::Info,
        "startup",
        "GO-UI-001",
        "luthier_orchestrator_started",
        serde_json::json!({
            "play": cli.play,
            "play_splash": cli.play_splash,
            "doctor": cli.doctor,
            "winecfg": cli.winecfg,
            "show_payload": cli.show_payload,
            "show_base64_hero_image": cli.show_hero_image_base64,
            "save_payload": cli.save_payload,
            "lang": cli.lang,
            "set_mangohud": cli.set_mangohud.as_ref().map(|v| format!("{v:?}")),
            "set_gamescope": cli.set_gamescope.as_ref().map(|v| format!("{v:?}")),
            "set_gamemode": cli.set_gamemode.as_ref().map(|v| format!("{v:?}")),
            "set_umu": cli.set_umu.as_ref().map(|v| format!("{v:?}")),
            "set_winetricks": cli.set_winetricks.as_ref().map(|v| format!("{v:?}")),
            "set_steam_runtime": cli.set_steam_runtime.as_ref().map(|v| format!("{v:?}")),
            "set_prime_offload": cli.set_prime_offload.as_ref().map(|v| format!("{v:?}")),
            "set_wine_wayland": cli.set_wine_wayland.as_ref().map(|v| format!("{v:?}")),
            "set_hdr": cli.set_hdr.as_ref().map(|v| format!("{v:?}")),
            "set_auto_dxvk_nvapi": cli.set_auto_dxvk_nvapi.as_ref().map(|v| format!("{v:?}")),
            "set_easy_anti_cheat_runtime": cli.set_easy_anti_cheat_runtime.as_ref().map(|v| format!("{v:?}")),
            "set_battleye_runtime": cli.set_battleye_runtime.as_ref().map(|v| format!("{v:?}")),
        }),
    );
}

fn should_log_startup_event(cli: &Cli) -> bool {
    if cli.doctor || cli.show_payload || cli.show_hero_image_base64 || cli.save_payload {
        return false;
    }

    has_execution_stage_requested(cli)
}

fn route_explicit_commands(trace_id: &str, cli: &Cli) -> anyhow::Result<bool> {
    if !has_cli_actions(cli) {
        return Ok(false);
    }

    if cli.doctor {
        run_doctor_command(trace_id).context("doctor command failed")?;
    }

    if cli.show_payload {
        run_show_payload_command(trace_id, false)
            .context("failed to print embedded payload from current executable")?;
    }

    if cli.show_hero_image_base64 {
        run_show_payload_command(trace_id, true)
            .context("failed to print embedded payload with hero image base64")?;
    }

    if cli.save_payload {
        run_save_payload_command(trace_id).context("failed to save embedded payload")?;
    }

    if has_config_override_flags(cli) {
        let should_print_config_output = !has_execution_stage_requested(cli)
            && !cli.doctor
            && !cli.show_payload
            && !cli.show_hero_image_base64
            && !cli.save_payload;
        run_config_command(trace_id, cli, should_print_config_output)
            .context("failed to apply runtime override flags")?;
    }

    if cli.play_splash || cli.play {
        route_play_command(trace_id, cli)?;
    } else if cli.winecfg {
        run_winecfg_command(trace_id).context("winecfg command failed")?;
    }

    Ok(true)
}

fn route_play_command(trace_id: &str, cli: &Cli) -> anyhow::Result<()> {
    if cli.play_splash {
        run_splash_flow(
            SplashLaunchMode::ExplicitPlayWithSplash,
            cli.lang.as_deref(),
        )
        .context("splash play flow failed")?;
        return Ok(());
    }

    run_play(trace_id).context("play flow failed")?;
    Ok(())
}

fn route_implicit_splash(cli: &Cli) -> anyhow::Result<bool> {
    if !should_try_implicit_splash(cli) {
        return Ok(false);
    }

    if try_load_embedded_config()?.is_some() {
        run_splash_flow(SplashLaunchMode::ImplicitDoubleClick, cli.lang.as_deref())
            .context("implicit splash flow failed")?;
        return Ok(true);
    }

    Ok(false)
}

fn should_try_implicit_splash(cli: &Cli) -> bool {
    !has_cli_actions(cli)
}

fn has_cli_actions(cli: &Cli) -> bool {
    cli.play
        || cli.play_splash
        || cli.doctor
        || cli.winecfg
        || cli.show_payload
        || cli.show_hero_image_base64
        || cli.save_payload
        || has_config_override_flags(cli)
}

fn has_execution_stage_requested(cli: &Cli) -> bool {
    cli.play || cli.play_splash || cli.winecfg
}

fn print_noop_hint() {
    println!(
        "Nada para executar. Use --show-payload, --show-base64-hero-image, --save-payload, --doctor, --winecfg, --set-<feature> on|off|default, --play ou --play-splash."
    );
}
