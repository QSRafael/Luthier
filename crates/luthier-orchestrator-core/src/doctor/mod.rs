use chrono::{SecondsFormat, Utc};

use crate::config::GameConfig;

mod dependency_checks;
mod host_probe;
mod models;
mod runtime_selection;
mod status_policy;

pub use models::{CheckStatus, DependencyStatus, DoctorReport, RuntimeDiscovery};

pub fn run_doctor(config: Option<&GameConfig>) -> DoctorReport {
    let requested_proton_version = config.and_then(|cfg| {
        let value = cfg.runner.proton_version.trim();
        if value.is_empty() {
            None
        } else {
            Some(value.to_string())
        }
    });
    let (proton_path, proton_version_matched) =
        host_probe::discover_proton_with_preference(requested_proton_version.as_deref());
    let proton = proton_path.map(host_probe::path_to_string);
    let wine = host_probe::discover_wine().map(host_probe::path_to_string);
    let umu_run = host_probe::discover_umu().map(host_probe::path_to_string);

    let runtime = runtime_selection::evaluate_runtime(
        config,
        proton.clone(),
        wine.clone(),
        umu_run.clone(),
        requested_proton_version.as_deref(),
        proton_version_matched,
    );

    let dependencies = status_policy::apply_dependency_status_policy(
        dependency_checks::evaluate_dependencies(config, &runtime),
    );

    let mut summary = runtime.runtime_status;
    for dep in &dependencies {
        summary = status_policy::worse_status(summary, dep.status);
    }

    DoctorReport {
        generated_at: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
        has_embedded_config: config.is_some(),
        runtime,
        dependencies,
        summary,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{FeatureState, RuntimeCandidate};

    #[test]
    fn worse_status_prefers_blocker() {
        assert_eq!(
            super::status_policy::worse_status(CheckStatus::OK, CheckStatus::BLOCKER),
            CheckStatus::BLOCKER
        );
        assert_eq!(
            super::status_policy::worse_status(CheckStatus::WARN, CheckStatus::INFO),
            CheckStatus::WARN
        );
    }

    #[test]
    fn evaluates_component_policies() {
        let missing_mandatory = super::dependency_checks::evaluate_component(
            "gamescope",
            Some(FeatureState::MandatoryOn),
            None,
        );
        assert_eq!(missing_mandatory.status, CheckStatus::BLOCKER);

        let forced_off = super::dependency_checks::evaluate_component(
            "gamescope",
            Some(FeatureState::MandatoryOff),
            None,
        );
        assert_eq!(forced_off.status, CheckStatus::INFO);
    }

    #[test]
    fn reorder_candidates_prioritizes_preferred_entries_present_in_policy() {
        let base = vec![
            RuntimeCandidate::ProtonNative,
            RuntimeCandidate::Wine,
            RuntimeCandidate::ProtonUmu,
        ];

        let reordered = super::runtime_selection::reorder_candidates(
            &base,
            &[
                RuntimeCandidate::ProtonUmu,
                RuntimeCandidate::ProtonNative,
                RuntimeCandidate::Wine,
            ],
        );

        assert_eq!(
            reordered,
            vec![
                RuntimeCandidate::ProtonUmu,
                RuntimeCandidate::ProtonNative,
                RuntimeCandidate::Wine,
            ]
        );
    }
}
