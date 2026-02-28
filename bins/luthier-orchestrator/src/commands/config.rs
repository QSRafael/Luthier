use anyhow::{anyhow, Context};

use crate::{
    application::runtime_overrides::{
        apply_toggle_request, build_feature_view, feature_overridable, load_runtime_overrides,
        runtime_overrides_path, save_runtime_overrides, set_optional_override,
    },
    cli::Cli,
    infrastructure::payload_loader::load_embedded_config_required,
};

pub fn run_config_command(_trace_id: &str, cli: &Cli, print_output: bool) -> anyhow::Result<()> {
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
    changed |= apply_toggle_request(
        "umu",
        config.requirements.umu,
        cli.set_umu,
        &mut overrides.umu,
    )?;
    changed |= apply_toggle_request(
        "winetricks",
        config.requirements.winetricks,
        cli.set_winetricks,
        &mut overrides.winetricks,
    )?;
    changed |= apply_toggle_request(
        "steam_runtime",
        config.requirements.steam_runtime,
        cli.set_steam_runtime,
        &mut overrides.steam_runtime,
    )?;
    changed |= apply_toggle_request(
        "prime_offload",
        config.environment.prime_offload,
        cli.set_prime_offload,
        &mut overrides.prime_offload,
    )?;
    changed |= apply_toggle_request(
        "wine_wayland",
        config.compatibility.wine_wayland,
        cli.set_wine_wayland,
        &mut overrides.wine_wayland,
    )?;
    changed |= apply_toggle_request(
        "hdr",
        config.compatibility.hdr,
        cli.set_hdr,
        &mut overrides.hdr,
    )?;
    changed |= apply_toggle_request(
        "auto_dxvk_nvapi",
        config.compatibility.auto_dxvk_nvapi,
        cli.set_auto_dxvk_nvapi,
        &mut overrides.auto_dxvk_nvapi,
    )?;
    changed |= apply_toggle_request(
        "easy_anti_cheat_runtime",
        config.compatibility.easy_anti_cheat_runtime,
        cli.set_easy_anti_cheat_runtime,
        &mut overrides.easy_anti_cheat_runtime,
    )?;
    changed |= apply_toggle_request(
        "battleye_runtime",
        config.compatibility.battleye_runtime,
        cli.set_battleye_runtime,
        &mut overrides.battleye_runtime,
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

    if print_output {
        let features = vec![
            build_feature_view("mangohud", config.requirements.mangohud, overrides.mangohud),
            build_feature_view(
                "gamescope",
                config.environment.gamescope.state,
                overrides.gamescope,
            ),
            build_feature_view("gamemode", config.requirements.gamemode, overrides.gamemode),
            build_feature_view("umu", config.requirements.umu, overrides.umu),
            build_feature_view(
                "winetricks",
                config.requirements.winetricks,
                overrides.winetricks,
            ),
            build_feature_view(
                "steam_runtime",
                config.requirements.steam_runtime,
                overrides.steam_runtime,
            ),
            build_feature_view(
                "prime_offload",
                config.environment.prime_offload,
                overrides.prime_offload,
            ),
            build_feature_view(
                "wine_wayland",
                config.compatibility.wine_wayland,
                overrides.wine_wayland,
            ),
            build_feature_view("hdr", config.compatibility.hdr, overrides.hdr),
            build_feature_view(
                "auto_dxvk_nvapi",
                config.compatibility.auto_dxvk_nvapi,
                overrides.auto_dxvk_nvapi,
            ),
            build_feature_view(
                "easy_anti_cheat_runtime",
                config.compatibility.easy_anti_cheat_runtime,
                overrides.easy_anti_cheat_runtime,
            ),
            build_feature_view(
                "battleye_runtime",
                config.compatibility.battleye_runtime,
                overrides.battleye_runtime,
            ),
        ];

        let output = serde_json::json!({
            "status": "OK",
            "override_file": override_path,
            "changed": changed,
            "features": features,
            "usage": {
                "set": "--set-mangohud on|off|default --set-gamescope on|off|default --set-gamemode on|off|default --set-umu on|off|default --set-winetricks on|off|default --set-steam-runtime on|off|default --set-prime-offload on|off|default --set-wine-wayland on|off|default --set-hdr on|off|default --set-auto-dxvk-nvapi on|off|default --set-easy-anti-cheat-runtime on|off|default --set-battleye-runtime on|off|default",
                "play": "--play"
            }
        });

        println!(
            "{}",
            serde_json::to_string_pretty(&output).context("failed to serialize config output")?
        );
    }

    Ok(())
}
