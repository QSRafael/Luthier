use std::collections::HashSet;
use std::io::IsTerminal;

use anyhow::Context;
use luthier_orchestrator_core::{
    doctor::{CheckStatus, DependencyStatus, DoctorReport},
    FeatureState, GameConfig, RuntimeCandidate,
};

use crate::application::doctor_flow::execute_doctor_flow;
use crate::infrastructure::payload_loader::try_load_embedded_config;

const CORE_ESSENTIAL_DEPENDENCIES: &[&str] = &["winetricks", "umu-run", "proton", "wine"];

pub fn run_doctor_command(_trace_id: &str, verbose: bool) -> anyhow::Result<()> {
    let config = try_load_embedded_config().context("failed to inspect embedded payload")?;
    let execution = execute_doctor_flow(config.as_ref())?;
    let mut categories = build_categorized_doctor_output(&execution.report, config.as_ref());
    sort_categories(&mut categories);
    print_categorized_doctor_output(&categories, verbose);
    Ok(())
}

#[derive(Debug, Default)]
struct DoctorCategories {
    essential: Vec<DoctorEntry>,
    additional: Vec<DoctorEntry>,
    optional: Vec<DoctorEntry>,
}

#[derive(Debug, Clone)]
struct DoctorEntry {
    name: String,
    status: CheckStatus,
    note: String,
    resolved_path: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DoctorCategory {
    Essential,
    Additional,
    Optional,
}

fn build_categorized_doctor_output(
    report: &DoctorReport,
    config: Option<&GameConfig>,
) -> DoctorCategories {
    let mut out = DoctorCategories::default();

    if let Some(cfg) = config {
        add_runtime_core_entries(&mut out, report, cfg);
    } else {
        add_runtime_entry_without_policy(
            &mut out.essential,
            "proton",
            report.runtime.proton.clone(),
        );
        add_runtime_entry_without_policy(&mut out.essential, "wine", report.runtime.wine.clone());
    }

    let additional_names = config
        .map(|cfg| {
            cfg.extra_system_dependencies
                .iter()
                .map(|dep| dep.name.to_ascii_lowercase())
                .collect::<HashSet<_>>()
        })
        .unwrap_or_default();

    for dep in &report.dependencies {
        if matches!(dep.state, Some(FeatureState::MandatoryOff)) {
            continue;
        }

        let category = classify_dependency_category(dep, &additional_names);
        push_entry(
            &mut out,
            category,
            DoctorEntry {
                name: dep.name.clone(),
                status: dep.status,
                note: dep.note.clone(),
                resolved_path: dep.resolved_path.clone(),
            },
        );
    }

    out
}

fn add_runtime_entry_without_policy(
    target: &mut Vec<DoctorEntry>,
    name: &str,
    resolved_path: Option<String>,
) {
    let found = resolved_path.is_some();
    target.push(DoctorEntry {
        name: name.to_string(),
        status: if found {
            CheckStatus::OK
        } else {
            CheckStatus::WARN
        },
        note: if found {
            "discovered".to_string()
        } else {
            "not found".to_string()
        },
        resolved_path,
    });
}

fn add_runtime_core_entries(out: &mut DoctorCategories, report: &DoctorReport, cfg: &GameConfig) {
    let proton_state = merged_proton_policy_state(cfg);
    if !matches!(proton_state, FeatureState::MandatoryOff) {
        push_entry(
            out,
            DoctorCategory::Essential,
            make_runtime_policy_entry("proton", proton_state, report.runtime.proton.clone()),
        );
    }

    let wine_state = runtime_candidate_policy_state(cfg, RuntimeCandidate::Wine);
    if !matches!(wine_state, FeatureState::MandatoryOff) {
        push_entry(
            out,
            DoctorCategory::Essential,
            make_runtime_policy_entry("wine", wine_state, report.runtime.wine.clone()),
        );
    }
}

fn make_runtime_policy_entry(
    name: &str,
    state: FeatureState,
    resolved_path: Option<String>,
) -> DoctorEntry {
    let found = resolved_path.is_some();
    let status = status_from_policy_state(state, found);
    DoctorEntry {
        name: name.to_string(),
        status,
        note: note_from_policy_state(state, found),
        resolved_path,
    }
}

fn status_from_policy_state(state: FeatureState, found: bool) -> CheckStatus {
    match state {
        FeatureState::MandatoryOn => {
            if found {
                CheckStatus::OK
            } else {
                CheckStatus::BLOCKER
            }
        }
        FeatureState::MandatoryOff => CheckStatus::INFO,
        FeatureState::OptionalOn => {
            if found {
                CheckStatus::OK
            } else {
                CheckStatus::WARN
            }
        }
        FeatureState::OptionalOff => CheckStatus::INFO,
    }
}

fn note_from_policy_state(state: FeatureState, found: bool) -> String {
    match state {
        FeatureState::MandatoryOn => {
            if found {
                "required and available".to_string()
            } else {
                "required but missing".to_string()
            }
        }
        FeatureState::MandatoryOff => "forced off by policy".to_string(),
        FeatureState::OptionalOn => {
            if found {
                "optional and enabled (available)".to_string()
            } else {
                "optional and enabled (missing)".to_string()
            }
        }
        FeatureState::OptionalOff => {
            if found {
                "optional and disabled by default (available)".to_string()
            } else {
                "optional and disabled by default (missing)".to_string()
            }
        }
    }
}

fn classify_dependency_category(
    dep: &DependencyStatus,
    additional_names: &HashSet<String>,
) -> DoctorCategory {
    let lower_name = dep.name.to_ascii_lowercase();

    if additional_names.contains(&lower_name) {
        return DoctorCategory::Additional;
    }

    if CORE_ESSENTIAL_DEPENDENCIES.contains(&lower_name.as_str()) {
        return DoctorCategory::Essential;
    }

    match dep.state {
        Some(FeatureState::MandatoryOn) => DoctorCategory::Essential,
        Some(FeatureState::OptionalOn | FeatureState::OptionalOff) => DoctorCategory::Optional,
        Some(FeatureState::MandatoryOff) => DoctorCategory::Optional,
        None => DoctorCategory::Essential,
    }
}

fn push_entry(categories: &mut DoctorCategories, category: DoctorCategory, entry: DoctorEntry) {
    match category {
        DoctorCategory::Essential => categories.essential.push(entry),
        DoctorCategory::Additional => categories.additional.push(entry),
        DoctorCategory::Optional => categories.optional.push(entry),
    }
}

fn sort_categories(categories: &mut DoctorCategories) {
    fn sort_and_dedup(items: &mut Vec<DoctorEntry>) {
        items.sort_by(|a, b| {
            a.name
                .to_ascii_lowercase()
                .cmp(&b.name.to_ascii_lowercase())
        });
        items.dedup_by(|a, b| a.name.eq_ignore_ascii_case(&b.name));
    }

    sort_and_dedup(&mut categories.essential);
    sort_and_dedup(&mut categories.additional);
    sort_and_dedup(&mut categories.optional);
}

fn runtime_candidate_policy_state(cfg: &GameConfig, candidate: RuntimeCandidate) -> FeatureState {
    if cfg.requirements.runtime.strict {
        if cfg.requirements.runtime.primary == candidate {
            FeatureState::MandatoryOn
        } else {
            FeatureState::MandatoryOff
        }
    } else if cfg.requirements.runtime.primary == candidate {
        FeatureState::OptionalOn
    } else if cfg.requirements.runtime.fallback_order.contains(&candidate) {
        FeatureState::OptionalOff
    } else {
        FeatureState::MandatoryOff
    }
}

fn merged_proton_policy_state(cfg: &GameConfig) -> FeatureState {
    let proton_native = runtime_candidate_policy_state(cfg, RuntimeCandidate::ProtonNative);
    let proton_umu = runtime_candidate_policy_state(cfg, RuntimeCandidate::ProtonUmu);
    merge_feature_states(proton_native, proton_umu)
}

fn merge_feature_states(a: FeatureState, b: FeatureState) -> FeatureState {
    use FeatureState::{MandatoryOff, MandatoryOn, OptionalOff, OptionalOn};
    let rank = |state| match state {
        MandatoryOn => 4_u8,
        OptionalOn => 3_u8,
        OptionalOff => 2_u8,
        MandatoryOff => 1_u8,
    };
    if rank(a) >= rank(b) {
        a
    } else {
        b
    }
}

fn print_categorized_doctor_output(categories: &DoctorCategories, verbose: bool) {
    let use_color = stdout_supports_color();
    print_section("Essenciais", &categories.essential, verbose, use_color);
    print_section("Adicionais", &categories.additional, verbose, use_color);
    print_section("Opcionais", &categories.optional, verbose, use_color);
}

fn print_section(title: &str, entries: &[DoctorEntry], verbose: bool, use_color: bool) {
    if entries.is_empty() {
        return;
    }

    println!("{}", style_title(title, use_color));
    for entry in entries {
        let icon = status_icon(entry.status);
        let status_colored = style_status(icon, entry.status, use_color);
        println!("{status_colored} {}", entry.name);

        if verbose {
            let mut details = Vec::new();
            if !entry.note.trim().is_empty() {
                details.push(entry.note.trim().to_string());
            }
            if let Some(path) = entry
                .resolved_path
                .as_ref()
                .map(|value| value.trim())
                .filter(|value| !value.is_empty())
            {
                details.push(path.to_string());
            }

            if !details.is_empty() {
                println!("  {}", style_dimmed(&details.join(" | "), use_color));
            }
        }
    }
    println!();
}

fn status_icon(status: CheckStatus) -> &'static str {
    match status {
        CheckStatus::OK => "[✓]",
        CheckStatus::WARN => "[!]",
        CheckStatus::BLOCKER => "[✗]",
        CheckStatus::INFO => "[i]",
    }
}

fn stdout_supports_color() -> bool {
    std::io::stdout().is_terminal() && std::env::var_os("NO_COLOR").is_none()
}

fn style_title(text: &str, enabled: bool) -> String {
    style_with_code(text, "1;37", enabled)
}

fn style_dimmed(text: &str, enabled: bool) -> String {
    style_with_code(text, "90", enabled)
}

fn style_status(text: &str, status: CheckStatus, enabled: bool) -> String {
    let code = match status {
        CheckStatus::OK => "32",
        CheckStatus::WARN => "33",
        CheckStatus::BLOCKER => "31",
        CheckStatus::INFO => "36",
    };
    style_with_code(text, code, enabled)
}

fn style_with_code(text: &str, ansi_code: &str, enabled: bool) -> String {
    if !enabled {
        return text.to_string();
    }
    format!("\u{1b}[{ansi_code}m{text}\u{1b}[0m")
}
