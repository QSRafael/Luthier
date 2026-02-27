use crate::config::{GameConfig, RuntimeCandidate, RuntimePreference};

use super::{CheckStatus, RuntimeDiscovery};

pub(super) fn evaluate_runtime(
    config: Option<&GameConfig>,
    proton: Option<String>,
    wine: Option<String>,
    umu_run: Option<String>,
    requested_proton_version: Option<&str>,
    proton_version_matched: bool,
) -> RuntimeDiscovery {
    let has_proton = proton.is_some();
    let has_wine = wine.is_some();
    let has_umu = umu_run.is_some();

    if let Some(cfg) = config {
        let strict = cfg.requirements.runtime.strict;
        let candidates = effective_runtime_candidates(cfg);

        let selected_runtime = if strict {
            if let Some(primary) = candidates.first().copied() {
                if candidate_available(primary, has_proton, has_wine, has_umu) {
                    Some(primary)
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            candidates
                .into_iter()
                .find(|c| candidate_available(*c, has_proton, has_wine, has_umu))
        };

        let proton_runtime_selected = matches!(
            selected_runtime,
            Some(RuntimeCandidate::ProtonNative | RuntimeCandidate::ProtonUmu)
        );

        let (runtime_status, runtime_note) = if selected_runtime.is_none() {
            (
                CheckStatus::BLOCKER,
                "no runtime candidate available with current policy".to_string(),
            )
        } else if proton_runtime_selected {
            match (requested_proton_version, proton.as_deref(), proton_version_matched) {
                (Some(requested), Some(selected_path), true) => (
                    CheckStatus::OK,
                    format!(
                        "runtime candidate selected (requested proton version '{requested}' found at {selected_path})"
                    ),
                ),
                (Some(requested), Some(selected_path), false) if strict => (
                    CheckStatus::BLOCKER,
                    format!(
                        "requested proton version '{requested}' not found and runtime strict mode is enabled (fallback candidate path: {selected_path})"
                    ),
                ),
                (Some(requested), Some(selected_path), false) => (
                    CheckStatus::WARN,
                    format!(
                        "requested proton version '{requested}' not found; using fallback proton at {selected_path}"
                    ),
                ),
                _ => (CheckStatus::OK, "runtime candidate selected".to_string()),
            }
        } else {
            (CheckStatus::OK, "runtime candidate selected".to_string())
        };

        RuntimeDiscovery {
            proton,
            wine,
            umu_run,
            selected_runtime,
            runtime_status,
            runtime_note,
        }
    } else {
        let selected_runtime = if has_umu && has_proton {
            Some(RuntimeCandidate::ProtonUmu)
        } else if has_proton {
            Some(RuntimeCandidate::ProtonNative)
        } else if has_wine {
            Some(RuntimeCandidate::Wine)
        } else {
            None
        };

        let (runtime_status, runtime_note) = if let Some(selected) = selected_runtime {
            if matches!(
                selected,
                RuntimeCandidate::ProtonNative | RuntimeCandidate::ProtonUmu
            ) {
                match (requested_proton_version, proton.as_deref(), proton_version_matched) {
                    (Some(requested), Some(selected_path), true) => (
                        CheckStatus::OK,
                        format!(
                            "runtime discovered (requested proton version '{requested}' found at {selected_path})"
                        ),
                    ),
                    (Some(requested), Some(selected_path), false) => (
                        CheckStatus::WARN,
                        format!(
                            "runtime discovered but requested proton version '{requested}' was not found; using {selected_path}"
                        ),
                    ),
                    _ => (CheckStatus::OK, "runtime discovered".to_string()),
                }
            } else {
                (CheckStatus::OK, "runtime discovered".to_string())
            }
        } else {
            (
                CheckStatus::WARN,
                "no runtime discovered (doctor without embedded config)".to_string(),
            )
        };

        RuntimeDiscovery {
            proton,
            wine,
            umu_run,
            selected_runtime,
            runtime_status,
            runtime_note,
        }
    }
}

fn candidate_available(
    candidate: RuntimeCandidate,
    has_proton: bool,
    has_wine: bool,
    has_umu: bool,
) -> bool {
    match candidate {
        RuntimeCandidate::ProtonUmu => has_umu && has_proton,
        RuntimeCandidate::ProtonNative => has_proton,
        RuntimeCandidate::Wine => has_wine,
    }
}

fn effective_runtime_candidates(cfg: &GameConfig) -> Vec<RuntimeCandidate> {
    let mut base = Vec::new();
    push_unique_candidate(&mut base, cfg.requirements.runtime.primary);
    for candidate in &cfg.requirements.runtime.fallback_order {
        push_unique_candidate(&mut base, *candidate);
    }

    match cfg.runner.runtime_preference {
        RuntimePreference::Auto => base,
        RuntimePreference::Proton => reorder_candidates(
            &base,
            &[
                RuntimeCandidate::ProtonUmu,
                RuntimeCandidate::ProtonNative,
                RuntimeCandidate::Wine,
            ],
        ),
        RuntimePreference::Wine => reorder_candidates(
            &base,
            &[
                RuntimeCandidate::Wine,
                RuntimeCandidate::ProtonUmu,
                RuntimeCandidate::ProtonNative,
            ],
        ),
    }
}

pub(super) fn reorder_candidates(
    base: &[RuntimeCandidate],
    preferred_order: &[RuntimeCandidate],
) -> Vec<RuntimeCandidate> {
    let mut out = Vec::new();

    for preferred in preferred_order {
        if base.contains(preferred) {
            push_unique_candidate(&mut out, *preferred);
        }
    }

    for candidate in base {
        push_unique_candidate(&mut out, *candidate);
    }

    out
}

fn push_unique_candidate(out: &mut Vec<RuntimeCandidate>, candidate: RuntimeCandidate) {
    if !out.contains(&candidate) {
        out.push(candidate);
    }
}
