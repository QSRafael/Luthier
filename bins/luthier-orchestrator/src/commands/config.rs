use anyhow::{anyhow, Context};
use luthier_orchestrator_core::observability::LogLevel;

use crate::{
    cli::Cli,
    logging::log_event,
    overrides::{
        apply_toggle_request, build_feature_view, feature_overridable, load_runtime_overrides,
        runtime_overrides_path, save_runtime_overrides, set_optional_override,
    },
    payload::load_embedded_config_required,
};

pub fn run_config_command(trace_id: &str, cli: &Cli) -> anyhow::Result<()> {
    let config = load_embedded_config_required()?;
    let mut overrides = load_runtime_overrides(&config.exe_hash)?;
    let mut changed = false;

    changed |= apply_toggle_request(
        "mangohud",
        config.requirements.mangohud,
        cli.set_mangohud,
        &mut overrides.mangohud,
    )?;
    changed |= apply_toggle_request(
        "gamemode",
        config.requirements.gamemode,
        cli.set_gamemode,
        &mut overrides.gamemode,
    )?;

    if let Some(requested) = cli.set_gamescope {
        if !feature_overridable(config.environment.gamescope.state)
            || !feature_overridable(config.requirements.gamescope)
        {
            return Err(anyhow!(
                "feature 'gamescope' is not overridable with current policy"
            ));
        }
        changed |= set_optional_override(&mut overrides.gamescope, requested);
    }

    let override_path = if changed {
        save_runtime_overrides(&config.exe_hash, &overrides)?
    } else {
        runtime_overrides_path(&config.exe_hash)?
    };

    log_event(
        trace_id,
        LogLevel::Info,
        "config",
        "GO-UI-002",
        "config_overrides_loaded",
        serde_json::json!({
            "exe_hash": config.exe_hash,
            "changed": changed,
            "override_file": override_path,
        }),
    );

    let features = vec![
        build_feature_view("mangohud", config.requirements.mangohud, overrides.mangohud),
        build_feature_view(
            "gamescope",
            config.environment.gamescope.state,
            overrides.gamescope,
        ),
        build_feature_view("gamemode", config.requirements.gamemode, overrides.gamemode),
    ];

    let output = serde_json::json!({
        "status": "OK",
        "override_file": override_path,
        "changed": changed,
        "features": features,
        "usage": {
            "set": "--config --set-mangohud on|off|default --set-gamescope on|off|default --set-gamemode on|off|default",
            "play": "--play"
        }
    });

    println!(
        "{}",
        serde_json::to_string_pretty(&output).context("failed to serialize config output")?
    );

    Ok(())
}
