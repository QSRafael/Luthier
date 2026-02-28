use crate::config::FeatureState;

use super::{CheckStatus, DependencyStatus};

pub(super) fn apply_dependency_status_policy(
    mut dependencies: Vec<DependencyStatus>,
) -> Vec<DependencyStatus> {
    for dependency in &mut dependencies {
        if should_preserve_dependency_status(dependency.name.as_str()) {
            continue;
        }

        let (status, note) =
            map_feature_state_and_presence_to_status(dependency.state, dependency.found);
        dependency.status = status;
        dependency.note = note.to_string();
    }

    dependencies
}

pub(super) fn worse_status(a: CheckStatus, b: CheckStatus) -> CheckStatus {
    use CheckStatus::*;

    let rank = |value| match value {
        BLOCKER => 3,
        WARN => 2,
        OK => 1,
        INFO => 0,
    };

    if rank(a) >= rank(b) {
        a
    } else {
        b
    }
}

fn should_preserve_dependency_status(name: &str) -> bool {
    matches!(
        name,
        "gamemoderun" | "gamemode-umu-runtime" | "wine-wayland" | "hdr" | "dxvk-nvapi" | "staging"
    )
}

fn map_feature_state_and_presence_to_status(
    state: Option<FeatureState>,
    found: bool,
) -> (CheckStatus, &'static str) {
    match state {
        Some(FeatureState::MandatoryOn) => {
            if found {
                (CheckStatus::OK, "required and available")
            } else {
                (CheckStatus::BLOCKER, "required but missing")
            }
        }
        Some(FeatureState::MandatoryOff) => (CheckStatus::INFO, "forced off by policy"),
        Some(FeatureState::OptionalOn) => {
            if found {
                (CheckStatus::OK, "enabled in payload and available")
            } else {
                (CheckStatus::WARN, "enabled in payload but missing")
            }
        }
        Some(FeatureState::OptionalOff) => {
            if found {
                (
                    CheckStatus::INFO,
                    "not required by current payload (available)",
                )
            } else {
                (
                    CheckStatus::INFO,
                    "not required by current payload (missing)",
                )
            }
        }
        None => {
            if found {
                (CheckStatus::OK, "available")
            } else {
                (CheckStatus::WARN, "not found")
            }
        }
    }
}
