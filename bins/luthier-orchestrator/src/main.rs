mod application;
mod cli;
mod commands;
mod domain;
mod infrastructure;
mod instance_lock;
mod logging;
mod services;
mod splash;

use anyhow::{anyhow, Context};
use clap::Parser;
use luthier_orchestrator_core::observability::{new_trace_id, LogLevel};

use crate::cli::Cli;
use crate::commands::{
    run_config_command, run_doctor_command, run_play, run_show_embedded_config,
    run_winecfg_command,
};
use crate::infrastructure::payload_loader::try_load_embedded_config;
use crate::logging::log_event;
use crate::splash::{run_splash_flow, SplashLaunchMode};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let trace_id = new_trace_id();

    validate_cli_flags(&cli)?;
    log_startup_event(&trace_id, &cli);

    if route_explicit_commands(&trace_id, &cli)? {
        return Ok(());
    }

    if route_implicit_splash(&cli)? {
        return Ok(());
    }

    print_noop_hint();
    Ok(())
}

fn validate_cli_flags(cli: &Cli) -> anyhow::Result<()> {
    if has_config_override_flags(cli) && !cli.config {
        return Err(anyhow!(
            "override flags require --config (use --config --set-<feature> ...)"
        ));
    }

    if cli.splash && !cli.play {
        return Err(anyhow!(
            "--splash requires --play (or execute the generated launcher without arguments)"
        ));
    }

    Ok(())
}

fn has_config_override_flags(cli: &Cli) -> bool {
    cli.set_mangohud.is_some() || cli.set_gamescope.is_some() || cli.set_gamemode.is_some()
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
            "splash": cli.splash,
            "config": cli.config,
            "doctor": cli.doctor,
            "winecfg": cli.winecfg,
            "show_config": cli.show_config,
            "lang": cli.lang,
            "verbose": cli.verbose,
            "set_mangohud": cli.set_mangohud.as_ref().map(|v| format!("{v:?}")),
            "set_gamescope": cli.set_gamescope.as_ref().map(|v| format!("{v:?}")),
            "set_gamemode": cli.set_gamemode.as_ref().map(|v| format!("{v:?}")),
        }),
    );
}

fn route_explicit_commands(trace_id: &str, cli: &Cli) -> anyhow::Result<bool> {
    if cli.show_config {
        run_show_embedded_config(trace_id)
            .context("failed to print embedded config from current executable")?;
        return Ok(true);
    }

    if cli.doctor {
        run_doctor_command(trace_id, cli.verbose).context("doctor command failed")?;
        return Ok(true);
    }

    if cli.winecfg {
        run_winecfg_command(trace_id).context("winecfg command failed")?;
        return Ok(true);
    }

    if cli.config {
        run_config_command(trace_id, cli).context("config command failed")?;
        return Ok(true);
    }

    if cli.play {
        route_play_command(trace_id, cli)?;
        return Ok(true);
    }

    Ok(false)
}

fn route_play_command(trace_id: &str, cli: &Cli) -> anyhow::Result<()> {
    if cli.splash {
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
    if try_load_embedded_config()?.is_some() {
        run_splash_flow(SplashLaunchMode::ImplicitDoubleClick, cli.lang.as_deref())
            .context("implicit splash flow failed")?;
        return Ok(true);
    }

    Ok(false)
}

fn print_noop_hint() {
    println!(
        "Nada para executar. Use --show-config, --doctor, --winecfg, --config, --play ou --play --splash."
    );
}
