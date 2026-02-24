use std::{fs, path::PathBuf};

use anyhow::{anyhow, Context};
use orchestrator_core::{FeatureState, GameConfig};
use serde::{Deserialize, Serialize};

use crate::cli::OptionalToggle;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct RuntimeOverrides {
    pub mangohud: Option<bool>,
    pub gamescope: Option<bool>,
    pub gamemode: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ConfigFeatureView {
    pub feature: &'static str,
    pub policy_state: FeatureState,
    pub overridable: bool,
    pub default_enabled: bool,
    pub effective_enabled: bool,
    pub override_value: Option<bool>,
}

pub fn feature_enabled(state: FeatureState) -> bool {
    matches!(state, FeatureState::MandatoryOn | FeatureState::OptionalOn)
}

pub fn feature_overridable(state: FeatureState) -> bool {
    matches!(state, FeatureState::OptionalOn | FeatureState::OptionalOff)
}

pub fn build_feature_view(
    feature: &'static str,
    policy_state: FeatureState,
    override_value: Option<bool>,
) -> ConfigFeatureView {
    ConfigFeatureView {
        feature,
        policy_state,
        overridable: feature_overridable(policy_state),
        default_enabled: feature_default_enabled(policy_state),
        effective_enabled: effective_feature_enabled(policy_state, override_value),
        override_value,
    }
}

pub fn apply_toggle_request(
    feature_name: &str,
    state: FeatureState,
    requested: Option<OptionalToggle>,
    target: &mut Option<bool>,
) -> anyhow::Result<bool> {
    let Some(requested) = requested else {
        return Ok(false);
    };

    if !feature_overridable(state) {
        return Err(anyhow!(
            "feature '{}' is not overridable with current policy",
            feature_name
        ));
    }

    Ok(set_optional_override(target, requested))
}

pub fn set_optional_override(target: &mut Option<bool>, requested: OptionalToggle) -> bool {
    let next = match requested {
        OptionalToggle::On => Some(true),
        OptionalToggle::Off => Some(false),
        OptionalToggle::Default => None,
    };

    let changed = *target != next;
    *target = next;
    changed
}

pub fn runtime_overrides_path(exe_hash: &str) -> anyhow::Result<PathBuf> {
    let home = std::env::var_os("HOME").ok_or_else(|| anyhow!("HOME is not set"))?;
    Ok(PathBuf::from(home)
        .join(".local/share/GameOrchestrator/overrides")
        .join(format!("{exe_hash}.json")))
}

pub fn load_runtime_overrides(exe_hash: &str) -> anyhow::Result<RuntimeOverrides> {
    let path = runtime_overrides_path(exe_hash)?;
    if !path.exists() {
        return Ok(RuntimeOverrides::default());
    }

    let raw = fs::read_to_string(&path)
        .with_context(|| format!("failed to read runtime overrides at {}", path.display()))?;
    let parsed = serde_json::from_str::<RuntimeOverrides>(&raw)
        .with_context(|| format!("invalid runtime overrides at {}", path.display()))?;
    Ok(parsed)
}

pub fn save_runtime_overrides(
    exe_hash: &str,
    overrides: &RuntimeOverrides,
) -> anyhow::Result<PathBuf> {
    let path = runtime_overrides_path(exe_hash)?;
    let parent = path
        .parent()
        .ok_or_else(|| anyhow!("runtime override path has no parent"))?;
    fs::create_dir_all(parent)
        .with_context(|| format!("failed to create overrides directory {}", parent.display()))?;

    let payload =
        serde_json::to_vec_pretty(overrides).context("failed to serialize runtime overrides")?;
    fs::write(&path, payload)
        .with_context(|| format!("failed to write runtime overrides to {}", path.display()))?;
    Ok(path)
}

pub fn apply_runtime_overrides(config: &mut GameConfig, overrides: &RuntimeOverrides) {
    apply_optional_override(&mut config.requirements.mangohud, overrides.mangohud);
    apply_optional_override(&mut config.requirements.gamemode, overrides.gamemode);
    apply_optional_override(&mut config.environment.gamescope.state, overrides.gamescope);
    apply_optional_override(&mut config.requirements.gamescope, overrides.gamescope);
}

fn feature_default_enabled(state: FeatureState) -> bool {
    matches!(state, FeatureState::MandatoryOn | FeatureState::OptionalOn)
}

fn effective_feature_enabled(state: FeatureState, override_value: Option<bool>) -> bool {
    if feature_overridable(state) {
        override_value.unwrap_or_else(|| feature_default_enabled(state))
    } else {
        feature_default_enabled(state)
    }
}

fn apply_optional_override(state: &mut FeatureState, override_value: Option<bool>) {
    let Some(override_value) = override_value else {
        return;
    };

    if !feature_overridable(*state) {
        return;
    }

    *state = if override_value {
        FeatureState::OptionalOn
    } else {
        FeatureState::OptionalOff
    };
}
