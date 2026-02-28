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

#[cfg(test)]
mod tests {
    use crate::config::FeatureState;

    use super::{
        apply_dependency_status_policy, map_feature_state_and_presence_to_status,
        should_preserve_dependency_status, worse_status, CheckStatus, DependencyStatus,
    };

    #[test]
    fn maps_feature_state_and_presence_to_expected_status_and_note() {
        let cases = [
            (
                Some(FeatureState::MandatoryOn),
                true,
                CheckStatus::OK,
                "required and available",
            ),
            (
                Some(FeatureState::MandatoryOn),
                false,
                CheckStatus::BLOCKER,
                "required but missing",
            ),
            (
                Some(FeatureState::MandatoryOff),
                true,
                CheckStatus::INFO,
                "forced off by policy",
            ),
            (
                Some(FeatureState::MandatoryOff),
                false,
                CheckStatus::INFO,
                "forced off by policy",
            ),
            (
                Some(FeatureState::OptionalOn),
                true,
                CheckStatus::OK,
                "enabled in payload and available",
            ),
            (
                Some(FeatureState::OptionalOn),
                false,
                CheckStatus::WARN,
                "enabled in payload but missing",
            ),
            (
                Some(FeatureState::OptionalOff),
                true,
                CheckStatus::INFO,
                "not required by current payload (available)",
            ),
            (
                Some(FeatureState::OptionalOff),
                false,
                CheckStatus::INFO,
                "not required by current payload (missing)",
            ),
            (None, true, CheckStatus::OK, "available"),
            (None, false, CheckStatus::WARN, "not found"),
        ];

        for (state, found, expected_status, expected_note) in cases {
            let (status, note) = map_feature_state_and_presence_to_status(state, found);
            assert_eq!(status, expected_status);
            assert_eq!(note, expected_note);
        }
    }

    #[test]
    fn preserves_special_dependency_items_and_remaps_regular_ones() {
        let dependencies = vec![
            dependency(
                "wine-wayland",
                Some(FeatureState::MandatoryOn),
                false,
                CheckStatus::OK,
                "precomputed status must be preserved",
            ),
            dependency(
                "gamescope",
                Some(FeatureState::MandatoryOn),
                false,
                CheckStatus::INFO,
                "old note should be replaced",
            ),
        ];

        let evaluated = apply_dependency_status_policy(dependencies);

        assert_eq!(evaluated.len(), 2);
        assert_eq!(evaluated[0].name, "wine-wayland");
        assert_eq!(evaluated[0].status, CheckStatus::OK);
        assert_eq!(
            evaluated[0].note,
            "precomputed status must be preserved".to_string()
        );

        assert_eq!(evaluated[1].name, "gamescope");
        assert_eq!(evaluated[1].status, CheckStatus::BLOCKER);
        assert_eq!(evaluated[1].note, "required but missing".to_string());
    }

    #[test]
    fn identifies_all_special_dependency_names_for_preservation() {
        for name in [
            "gamemoderun",
            "gamemode-umu-runtime",
            "wine-wayland",
            "hdr",
            "dxvk-nvapi",
            "staging",
        ] {
            assert!(should_preserve_dependency_status(name));
        }

        for name in ["gamescope", "wine", "umu-run", "unknown-component"] {
            assert!(!should_preserve_dependency_status(name));
        }
    }

    #[test]
    fn worse_status_obeys_severity_ordering() {
        let all = [
            CheckStatus::INFO,
            CheckStatus::OK,
            CheckStatus::WARN,
            CheckStatus::BLOCKER,
        ];

        for left in all {
            for right in all {
                let expected = if rank(left) >= rank(right) {
                    left
                } else {
                    right
                };
                assert_eq!(worse_status(left, right), expected);
            }
        }
    }

    fn rank(status: CheckStatus) -> u8 {
        match status {
            CheckStatus::BLOCKER => 3,
            CheckStatus::WARN => 2,
            CheckStatus::OK => 1,
            CheckStatus::INFO => 0,
        }
    }

    fn dependency(
        name: &str,
        state: Option<FeatureState>,
        found: bool,
        status: CheckStatus,
        note: &str,
    ) -> DependencyStatus {
        DependencyStatus {
            name: name.to_string(),
            state,
            status,
            found,
            resolved_path: None,
            note: note.to_string(),
        }
    }
}
