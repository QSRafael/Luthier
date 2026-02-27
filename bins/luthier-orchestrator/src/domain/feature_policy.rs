use luthier_orchestrator_core::FeatureState;

pub fn enabled(state: FeatureState) -> bool {
    matches!(state, FeatureState::MandatoryOn | FeatureState::OptionalOn)
}

pub fn overridable(state: FeatureState) -> bool {
    matches!(state, FeatureState::OptionalOn | FeatureState::OptionalOff)
}

pub fn default_enabled(state: FeatureState) -> bool {
    matches!(state, FeatureState::MandatoryOn | FeatureState::OptionalOn)
}

pub fn effective_enabled(state: FeatureState, override_value: Option<bool>) -> bool {
    if overridable(state) {
        override_value.unwrap_or_else(|| default_enabled(state))
    } else {
        default_enabled(state)
    }
}
