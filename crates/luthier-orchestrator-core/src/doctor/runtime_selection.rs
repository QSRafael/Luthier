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
            candidates
                .first()
                .copied()
                .filter(|&primary| candidate_available(primary, has_proton, has_wine, has_umu))
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

        let (runtime_status, runtime_note) = selected_runtime.map_or_else(
            || {
                (
                    CheckStatus::WARN,
                    "no runtime discovered (doctor without embedded config)".to_string(),
                )
            },
            |selected| {
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
            },
        );

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

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::config::{
        CompatibilityConfig, EnvConfig, FeatureState, GameConfig, GamescopeConfig,
        RequirementsConfig, RunnerConfig, RuntimeCandidate, RuntimePolicy, RuntimePreference,
        ScriptsConfig, SplashConfig, WinecfgConfig, WinecfgFeaturePolicy,
    };

    use super::{evaluate_runtime, CheckStatus};

    #[test]
    fn strict_mode_blocks_when_primary_candidate_is_unavailable() {
        let cfg = sample_config(
            true,
            RuntimeCandidate::ProtonNative,
            vec![RuntimeCandidate::Wine],
            RuntimePreference::Auto,
            "GE-Proton9-10",
        );

        let result = evaluate_runtime(
            Some(&cfg),
            None,
            Some("/usr/bin/wine".to_string()),
            None,
            Some("GE-Proton9-10"),
            false,
        );

        assert_eq!(result.selected_runtime, None);
        assert_eq!(result.runtime_status, CheckStatus::BLOCKER);
        assert!(result
            .runtime_note
            .contains("no runtime candidate available"));
    }

    #[test]
    fn non_strict_mode_uses_fallback_when_primary_is_unavailable() {
        let cfg = sample_config(
            false,
            RuntimeCandidate::ProtonNative,
            vec![RuntimeCandidate::Wine],
            RuntimePreference::Auto,
            "GE-Proton9-10",
        );

        let result = evaluate_runtime(
            Some(&cfg),
            None,
            Some("/usr/bin/wine".to_string()),
            None,
            Some("GE-Proton9-10"),
            false,
        );

        assert_eq!(result.selected_runtime, Some(RuntimeCandidate::Wine));
        assert_eq!(result.runtime_status, CheckStatus::OK);
        assert_eq!(result.runtime_note, "runtime candidate selected");
    }

    #[test]
    fn runtime_preference_reorders_candidates_before_selection() {
        let cfg = sample_config(
            false,
            RuntimeCandidate::ProtonNative,
            vec![RuntimeCandidate::Wine],
            RuntimePreference::Wine,
            "GE-Proton9-10",
        );

        let result = evaluate_runtime(
            Some(&cfg),
            Some("/opt/proton/GE-Proton9-10/proton".to_string()),
            Some("/usr/bin/wine".to_string()),
            None,
            Some("GE-Proton9-10"),
            true,
        );

        assert_eq!(result.selected_runtime, Some(RuntimeCandidate::Wine));
        assert_eq!(result.runtime_status, CheckStatus::OK);
    }

    #[test]
    fn fallback_order_is_used_until_a_candidate_is_available() {
        let cfg = sample_config(
            false,
            RuntimeCandidate::Wine,
            vec![RuntimeCandidate::ProtonUmu, RuntimeCandidate::ProtonNative],
            RuntimePreference::Auto,
            "GE-Proton9-10",
        );

        let result = evaluate_runtime(
            Some(&cfg),
            Some("/opt/proton/GE-Proton9-10/proton".to_string()),
            None,
            None,
            Some("GE-Proton9-10"),
            true,
        );

        assert_eq!(
            result.selected_runtime,
            Some(RuntimeCandidate::ProtonNative)
        );
        assert_eq!(result.runtime_status, CheckStatus::OK);
    }

    #[test]
    fn embedded_config_without_any_runtime_candidate_is_blocker() {
        let cfg = sample_config(
            false,
            RuntimeCandidate::ProtonNative,
            vec![RuntimeCandidate::Wine],
            RuntimePreference::Auto,
            "GE-Proton9-10",
        );

        let result = evaluate_runtime(Some(&cfg), None, None, None, Some("GE-Proton9-10"), false);

        assert_eq!(result.selected_runtime, None);
        assert_eq!(result.runtime_status, CheckStatus::BLOCKER);
        assert!(result
            .runtime_note
            .contains("no runtime candidate available"));
    }

    #[test]
    fn requested_proton_version_not_found_warns_in_non_strict_mode() {
        let cfg = sample_config(
            false,
            RuntimeCandidate::ProtonNative,
            vec![RuntimeCandidate::Wine],
            RuntimePreference::Auto,
            "GE-Proton9-10",
        );

        let result = evaluate_runtime(
            Some(&cfg),
            Some("/opt/proton/default/proton".to_string()),
            Some("/usr/bin/wine".to_string()),
            None,
            Some("GE-Proton9-10"),
            false,
        );

        assert_eq!(
            result.selected_runtime,
            Some(RuntimeCandidate::ProtonNative)
        );
        assert_eq!(result.runtime_status, CheckStatus::WARN);
        assert!(result
            .runtime_note
            .contains("requested proton version 'GE-Proton9-10' not found"));
        assert!(result
            .runtime_note
            .contains("using fallback proton at /opt/proton/default/proton"));
    }

    #[test]
    fn requested_proton_version_not_found_blocks_in_strict_mode() {
        let cfg = sample_config(
            true,
            RuntimeCandidate::ProtonNative,
            vec![RuntimeCandidate::Wine],
            RuntimePreference::Auto,
            "GE-Proton9-10",
        );

        let result = evaluate_runtime(
            Some(&cfg),
            Some("/opt/proton/default/proton".to_string()),
            Some("/usr/bin/wine".to_string()),
            None,
            Some("GE-Proton9-10"),
            false,
        );

        assert_eq!(
            result.selected_runtime,
            Some(RuntimeCandidate::ProtonNative)
        );
        assert_eq!(result.runtime_status, CheckStatus::BLOCKER);
        assert!(result
            .runtime_note
            .contains("runtime strict mode is enabled"));
    }

    #[test]
    fn requested_proton_version_found_reports_ok() {
        let cfg = sample_config(
            true,
            RuntimeCandidate::ProtonNative,
            vec![RuntimeCandidate::Wine],
            RuntimePreference::Auto,
            "GE-Proton9-10",
        );

        let result = evaluate_runtime(
            Some(&cfg),
            Some("/opt/proton/GE-Proton9-10/proton".to_string()),
            Some("/usr/bin/wine".to_string()),
            None,
            Some("GE-Proton9-10"),
            true,
        );

        assert_eq!(
            result.selected_runtime,
            Some(RuntimeCandidate::ProtonNative)
        );
        assert_eq!(result.runtime_status, CheckStatus::OK);
        assert!(result
            .runtime_note
            .contains("requested proton version 'GE-Proton9-10' found"));
    }

    #[test]
    fn doctor_without_config_warns_when_no_runtime_is_discovered() {
        let result = evaluate_runtime(None, None, None, None, Some("GE-Proton9-10"), false);

        assert_eq!(result.selected_runtime, None);
        assert_eq!(result.runtime_status, CheckStatus::WARN);
        assert_eq!(
            result.runtime_note,
            "no runtime discovered (doctor without embedded config)"
        );
    }

    fn sample_config(
        strict: bool,
        primary: RuntimeCandidate,
        fallback_order: Vec<RuntimeCandidate>,
        runtime_preference: RuntimePreference,
        proton_version: &str,
    ) -> GameConfig {
        GameConfig {
            config_version: 1,
            created_by: "test".to_string(),
            game_name: "Sample".to_string(),
            exe_hash: "a".repeat(64),
            relative_exe_path: "./game.exe".to_string(),
            launch_args: vec![],
            runner: RunnerConfig {
                proton_version: proton_version.to_string(),
                auto_update: true,
                esync: true,
                fsync: true,
                runtime_preference,
            },
            environment: EnvConfig {
                gamemode: FeatureState::OptionalOn,
                gamescope: GamescopeConfig {
                    state: FeatureState::OptionalOff,
                    resolution: None,
                    fsr: false,
                    game_width: String::new(),
                    game_height: String::new(),
                    output_width: String::new(),
                    output_height: String::new(),
                    upscale_method: "fsr".to_string(),
                    window_type: "fullscreen".to_string(),
                    enable_limiter: false,
                    fps_limiter: String::new(),
                    fps_limiter_no_focus: String::new(),
                    force_grab_cursor: false,
                    additional_options: String::new(),
                },
                mangohud: FeatureState::OptionalOff,
                prime_offload: FeatureState::OptionalOff,
                custom_vars: HashMap::new(),
            },
            compatibility: CompatibilityConfig {
                wine_wayland: FeatureState::OptionalOff,
                hdr: FeatureState::OptionalOff,
                auto_dxvk_nvapi: FeatureState::OptionalOff,
                easy_anti_cheat_runtime: FeatureState::OptionalOff,
                battleye_runtime: FeatureState::OptionalOff,
                staging: FeatureState::OptionalOff,
                wrapper_commands: vec![],
            },
            winecfg: WinecfgConfig {
                windows_version: None,
                dll_overrides: vec![],
                auto_capture_mouse: WinecfgFeaturePolicy {
                    state: FeatureState::OptionalOn,
                    use_wine_default: true,
                },
                window_decorations: WinecfgFeaturePolicy {
                    state: FeatureState::OptionalOn,
                    use_wine_default: true,
                },
                window_manager_control: WinecfgFeaturePolicy {
                    state: FeatureState::OptionalOn,
                    use_wine_default: true,
                },
                virtual_desktop: crate::config::VirtualDesktopConfig {
                    state: WinecfgFeaturePolicy {
                        state: FeatureState::OptionalOff,
                        use_wine_default: true,
                    },
                    resolution: None,
                },
                screen_dpi: None,
                desktop_integration: WinecfgFeaturePolicy {
                    state: FeatureState::OptionalOn,
                    use_wine_default: true,
                },
                mime_associations: WinecfgFeaturePolicy {
                    state: FeatureState::OptionalOff,
                    use_wine_default: true,
                },
                desktop_folders: vec![],
                drives: vec![],
                audio_driver: None,
            },
            dependencies: vec![],
            extra_system_dependencies: vec![],
            requirements: RequirementsConfig {
                runtime: RuntimePolicy {
                    strict,
                    primary,
                    fallback_order,
                },
                umu: FeatureState::OptionalOn,
                winetricks: FeatureState::OptionalOff,
                gamescope: FeatureState::OptionalOff,
                gamemode: FeatureState::OptionalOn,
                mangohud: FeatureState::OptionalOff,
                steam_runtime: FeatureState::OptionalOff,
            },
            registry_keys: vec![],
            integrity_files: vec!["./data/core.dll".to_string()],
            folder_mounts: vec![],
            splash: SplashConfig::default(),
            scripts: ScriptsConfig {
                pre_launch: String::new(),
                post_launch: String::new(),
            },
        }
    }
}
