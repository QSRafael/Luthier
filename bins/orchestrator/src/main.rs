use std::{
    fs, io,
    path::{Path, PathBuf},
};

use anyhow::{anyhow, Context};
use clap::{Parser, ValueEnum};
use orchestrator_core::{
    doctor::{run_doctor, CheckStatus, DoctorReport},
    observability::{emit_ndjson, new_trace_id, LogEvent, LogIdentity, LogLevel},
    prefix::{base_env_for_prefix, build_prefix_setup_plan},
    process::{
        execute_external_command, execute_prefix_setup_plan, has_mandatory_failures,
        CommandExecutionResult, ExternalCommand, StepStatus,
    },
    trailer::extract_config_json,
    FeatureState, GameConfig, OrchestratorError, RuntimeCandidate,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Parser)]
#[command(name = "orchestrator")]
#[command(about = "Game Orchestrator CLI")]
struct Cli {
    #[arg(long)]
    play: bool,

    #[arg(long)]
    config: bool,

    #[arg(long)]
    doctor: bool,

    #[arg(long)]
    verbose: bool,

    #[arg(long)]
    show_config: bool,

    #[arg(long)]
    lang: Option<String>,

    #[arg(long, value_enum)]
    set_mangohud: Option<OptionalToggle>,

    #[arg(long, value_enum)]
    set_gamescope: Option<OptionalToggle>,

    #[arg(long, value_enum)]
    set_gamemode: Option<OptionalToggle>,
}

#[derive(Debug, Serialize)]
struct LaunchCommandPlan {
    program: String,
    args: Vec<String>,
    cwd: String,
    runtime: String,
    env: Vec<(String, String)>,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum OptionalToggle {
    On,
    Off,
    Default,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
struct RuntimeOverrides {
    mangohud: Option<bool>,
    gamescope: Option<bool>,
    gamemode: Option<bool>,
}

#[derive(Debug, Serialize)]
struct ConfigFeatureView {
    feature: &'static str,
    policy_state: FeatureState,
    overridable: bool,
    default_enabled: bool,
    effective_enabled: bool,
    override_value: Option<bool>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let trace_id = new_trace_id();
    let has_config_override_flags =
        cli.set_mangohud.is_some() || cli.set_gamescope.is_some() || cli.set_gamemode.is_some();

    if has_config_override_flags && !cli.config {
        return Err(anyhow!(
            "override flags require --config (use --config --set-<feature> ...)"
        ));
    }

    log_event(
        &trace_id,
        LogLevel::Info,
        "startup",
        "GO-UI-001",
        "orchestrator_started",
        serde_json::json!({
            "play": cli.play,
            "config": cli.config,
            "doctor": cli.doctor,
            "show_config": cli.show_config,
            "lang": cli.lang,
            "verbose": cli.verbose,
            "set_mangohud": cli.set_mangohud.as_ref().map(|v| format!("{v:?}")),
            "set_gamescope": cli.set_gamescope.as_ref().map(|v| format!("{v:?}")),
            "set_gamemode": cli.set_gamemode.as_ref().map(|v| format!("{v:?}")),
        }),
    );

    if cli.show_config {
        show_embedded_config(&trace_id)
            .context("failed to print embedded config from current executable")?;
        return Ok(());
    }

    if cli.doctor {
        run_doctor_command(&trace_id).context("doctor command failed")?;
        return Ok(());
    }

    if cli.config {
        run_config_command(&trace_id, &cli).context("config command failed")?;
        return Ok(());
    }

    if cli.play {
        run_play(&trace_id).context("play flow failed")?;
        return Ok(());
    }

    println!("Nada para executar. Use --show-config, --doctor, --config ou --play.");
    Ok(())
}

fn show_embedded_config(trace_id: &str) -> anyhow::Result<()> {
    let parsed = load_embedded_config_required()?;

    log_event(
        trace_id,
        LogLevel::Info,
        "config",
        "GO-CFG-001",
        "embedded_config_loaded",
        serde_json::json!({
            "game_name": parsed.game_name,
            "exe_hash": parsed.exe_hash,
            "config_version": parsed.config_version,
        }),
    );

    let pretty = serde_json::to_string_pretty(&parsed).context("failed to format config")?;
    println!("{pretty}");

    Ok(())
}

fn run_doctor_command(trace_id: &str) -> anyhow::Result<()> {
    let embedded_config =
        try_load_embedded_config().context("failed to inspect embedded config")?;
    let prefix_plan = embedded_config
        .as_ref()
        .map(build_prefix_setup_plan)
        .transpose()
        .context("failed to build prefix setup plan")?;

    if embedded_config.is_none() {
        log_event(
            trace_id,
            LogLevel::Warn,
            "doctor",
            "GO-DR-002",
            "doctor_running_without_embedded_config",
            serde_json::json!({}),
        );
    }

    let report = run_doctor(embedded_config.as_ref());

    log_event(
        trace_id,
        LogLevel::Info,
        "doctor",
        "GO-DR-003",
        "doctor_finished",
        serde_json::json!({
            "summary": report.summary,
            "has_embedded_config": report.has_embedded_config,
        }),
    );

    let output = serde_json::json!({
        "doctor": report,
        "prefix_setup_plan": prefix_plan,
    });
    let pretty =
        serde_json::to_string_pretty(&output).context("failed to serialize doctor report")?;
    println!("{pretty}");

    Ok(())
}

fn run_config_command(trace_id: &str, cli: &Cli) -> anyhow::Result<()> {
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

fn run_play(trace_id: &str) -> anyhow::Result<()> {
    let mut config = load_embedded_config_required()?;
    let overrides = load_runtime_overrides(&config.exe_hash)?;
    apply_runtime_overrides(&mut config, &overrides);

    log_event(
        trace_id,
        LogLevel::Info,
        "config",
        "GO-CFG-021",
        "runtime_overrides_applied",
        serde_json::json!({
            "mangohud": overrides.mangohud,
            "gamescope": overrides.gamescope,
            "gamemode": overrides.gamemode,
        }),
    );

    let game_root = resolve_game_root().context("failed to resolve game root")?;
    let dry_run = dry_run_enabled();

    let missing_files =
        validate_integrity(&config, &game_root).context("invalid integrity path in payload")?;
    if !missing_files.is_empty() {
        let output = serde_json::json!({
            "integrity": {
                "status": "BLOCKER",
                "missing_files": missing_files,
            },
            "launch": {
                "status": "aborted",
                "reason": "required game files are missing"
            }
        });

        println!(
            "{}",
            serde_json::to_string_pretty(&output).context("failed to serialize integrity error")?
        );

        return Err(anyhow!("integrity check failed"));
    }

    log_event(
        trace_id,
        LogLevel::Info,
        "integrity",
        "GO-CFG-020",
        "integrity_check_passed",
        serde_json::json!({
            "integrity_files_count": config.integrity_files.len(),
            "relative_exe_path": config.relative_exe_path,
        }),
    );

    let report = run_doctor(Some(&config));
    log_event(
        trace_id,
        LogLevel::Info,
        "launcher",
        "GO-LN-010",
        "play_doctor_finished",
        serde_json::json!({
            "summary": report.summary,
        }),
    );

    if matches!(report.summary, CheckStatus::BLOCKER) {
        let output = serde_json::json!({
            "doctor": report,
            "launch": {
                "status": "aborted",
                "reason": "doctor returned BLOCKER"
            }
        });

        println!(
            "{}",
            serde_json::to_string_pretty(&output).context("failed to serialize doctor blocker")?
        );

        return Err(anyhow!("doctor returned BLOCKER"));
    }

    let prefix_plan = build_prefix_setup_plan(&config).context("failed to build prefix plan")?;
    let prefix_env = base_env_for_prefix(Path::new(&prefix_plan.prefix_path));
    let setup_results = execute_prefix_setup_plan(&prefix_plan, &prefix_env, dry_run);

    log_event(
        trace_id,
        LogLevel::Info,
        "prefix",
        "GO-PF-020",
        "prefix_setup_executed",
        serde_json::json!({
            "needs_init": prefix_plan.needs_init,
            "steps": setup_results.len(),
            "dry_run": dry_run,
        }),
    );

    if has_mandatory_failures(&setup_results) {
        let output = serde_json::json!({
            "doctor": report,
            "prefix_setup_plan": prefix_plan,
            "prefix_setup_execution": setup_results,
            "launch": {
                "status": "aborted",
                "reason": "mandatory prefix setup command failed"
            }
        });

        println!(
            "{}",
            serde_json::to_string_pretty(&output)
                .context("failed to serialize prefix failure output")?
        );

        return Err(anyhow!(
            "mandatory prefix setup step failed; launch aborted"
        ));
    }

    let prefix_path = PathBuf::from(&prefix_plan.prefix_path);
    let launch_plan = build_launch_command(&config, &report, &game_root, &prefix_path)
        .context("failed to build launch command")?;

    let pre_script_result = execute_script_if_present(
        "pre-launch-script",
        &config.scripts.pre_launch,
        &launch_plan.cwd,
        &launch_plan.env,
        dry_run,
        true,
    );

    if let Some(result) = &pre_script_result {
        log_event(
            trace_id,
            LogLevel::Info,
            "scripts",
            "GO-SC-020",
            "pre_launch_script_executed",
            serde_json::json!({
                "status": result.status,
                "exit_code": result.exit_code,
                "duration_ms": result.duration_ms,
            }),
        );
    }

    if let Some(result) = &pre_script_result {
        if matches!(result.status, StepStatus::Failed | StepStatus::TimedOut) {
            let output = serde_json::json!({
                "doctor": report,
                "prefix_setup_plan": prefix_plan,
                "prefix_setup_execution": setup_results,
                "pre_launch": result,
                "launch": {
                    "status": "aborted",
                    "reason": "pre-launch script failed"
                }
            });

            println!(
                "{}",
                serde_json::to_string_pretty(&output)
                    .context("failed to serialize pre-launch failure")?
            );

            return Err(anyhow!("pre-launch script failed"));
        }
    }

    let game_result = execute_external_command(
        &ExternalCommand {
            name: "game-launch".to_string(),
            program: launch_plan.program.clone(),
            args: launch_plan.args.clone(),
            timeout_secs: None,
            cwd: Some(launch_plan.cwd.clone()),
            mandatory: true,
        },
        &launch_plan.env,
        dry_run,
    );

    log_event(
        trace_id,
        LogLevel::Info,
        "launcher",
        "GO-LN-020",
        "game_command_executed",
        serde_json::json!({
            "status": game_result.status,
            "exit_code": game_result.exit_code,
            "duration_ms": game_result.duration_ms,
            "dry_run": dry_run,
        }),
    );

    let post_script_result = execute_script_if_present(
        "post-launch-script",
        &config.scripts.post_launch,
        &launch_plan.cwd,
        &launch_plan.env,
        dry_run,
        false,
    );

    if let Some(result) = &post_script_result {
        log_event(
            trace_id,
            LogLevel::Info,
            "scripts",
            "GO-SC-021",
            "post_launch_script_executed",
            serde_json::json!({
                "status": result.status,
                "exit_code": result.exit_code,
                "duration_ms": result.duration_ms,
            }),
        );
    }

    let launch_status = match game_result.status {
        StepStatus::Success => "completed",
        StepStatus::Skipped => "skipped",
        StepStatus::Failed | StepStatus::TimedOut => "failed",
    };

    let output = serde_json::json!({
        "doctor": report,
        "prefix_setup_plan": prefix_plan,
        "prefix_setup_execution": setup_results,
        "launch_plan": launch_plan,
        "pre_launch": pre_script_result,
        "game_launch": game_result,
        "post_launch": post_script_result,
        "launch": {
            "status": launch_status,
            "dry_run": dry_run
        }
    });

    println!(
        "{}",
        serde_json::to_string_pretty(&output).context("failed to serialize play output")?
    );

    if matches!(
        game_result.status,
        StepStatus::Failed | StepStatus::TimedOut
    ) {
        return Err(anyhow!("game launch command failed"));
    }

    Ok(())
}

fn build_launch_command(
    config: &GameConfig,
    report: &DoctorReport,
    game_root: &Path,
    prefix_path: &Path,
) -> anyhow::Result<LaunchCommandPlan> {
    let selected_runtime = report
        .runtime
        .selected_runtime
        .ok_or_else(|| anyhow!("doctor did not select a runtime"))?;

    let runtime_program =
        match selected_runtime {
            RuntimeCandidate::ProtonUmu => {
                report.runtime.umu_run.clone().ok_or_else(|| {
                    anyhow!("selected runtime ProtonUmu but umu-run path is missing")
                })?
            }
            RuntimeCandidate::ProtonNative => report.runtime.proton.clone().ok_or_else(|| {
                anyhow!("selected runtime ProtonNative but proton path is missing")
            })?,
            RuntimeCandidate::Wine => report
                .runtime
                .wine
                .clone()
                .ok_or_else(|| anyhow!("selected runtime Wine but wine path is missing"))?,
        };

    let game_exe = resolve_relative_path(game_root, &config.relative_exe_path)
        .context("invalid relative_exe_path in payload")?;
    let game_exe_str = game_exe.to_string_lossy().into_owned();

    let mut runtime_args = vec![game_exe_str];
    runtime_args.extend(config.launch_args.clone());

    let mut command_tokens = vec![runtime_program.clone()];
    command_tokens.extend(runtime_args);

    let gamescope_active = feature_enabled(config.environment.gamescope.state);
    let mangohud_active = feature_enabled(config.requirements.mangohud);

    if feature_enabled(config.requirements.gamemode) {
        if let Some(path) = dependency_path(report, "gamemoderun") {
            command_tokens = wrap_command(path, vec![], command_tokens);
        }
    }

    if mangohud_active && !gamescope_active {
        if let Some(path) = dependency_path(report, "mangohud") {
            command_tokens = wrap_command(path, vec![], command_tokens);
        }
    }

    for wrapper in config.compatibility.wrapper_commands.iter().rev() {
        if feature_enabled(wrapper.state) {
            let Some(wrapper_program) = resolve_wrapper_executable(&wrapper.executable) else {
                if matches!(wrapper.state, FeatureState::MandatoryOn) {
                    return Err(anyhow!(
                        "mandatory wrapper command '{}' is not available",
                        wrapper.executable
                    ));
                }
                continue;
            };

            let args = split_wrapper_args(&wrapper.args);
            command_tokens = wrap_command(wrapper_program, args, command_tokens);
        }
    }

    if gamescope_active {
        if let Some(path) = dependency_path(report, "gamescope") {
            let mut gamescope_args = Vec::new();

            if let Some(resolution) = &config.environment.gamescope.resolution {
                if let Some((w, h)) = parse_resolution(resolution) {
                    gamescope_args.push("-w".to_string());
                    gamescope_args.push(w.to_string());
                    gamescope_args.push("-h".to_string());
                    gamescope_args.push(h.to_string());
                }
            }

            if config.environment.gamescope.fsr {
                gamescope_args.push("-F".to_string());
                gamescope_args.push("fsr".to_string());
            }

            if mangohud_active {
                gamescope_args.push("--mangoapp".to_string());
            }

            gamescope_args.push("--".to_string());
            gamescope_args.extend(command_tokens);
            command_tokens = wrap_command(path, gamescope_args, Vec::new());
        }
    }

    let (program, args) = split_program_and_args(command_tokens)
        .ok_or_else(|| anyhow!("failed to build launch command"))?;

    let mut env_pairs = base_env_for_prefix(prefix_path);

    if matches!(selected_runtime, RuntimeCandidate::ProtonUmu) {
        if let Some(proton_path) = &report.runtime.proton {
            upsert_env(&mut env_pairs, "PROTONPATH", proton_path);
        }
    }

    if config.environment.prime_offload {
        upsert_env(&mut env_pairs, "__NV_PRIME_RENDER_OFFLOAD", "1");
        upsert_env(&mut env_pairs, "__GLX_VENDOR_LIBRARY_NAME", "nvidia");
        upsert_env(&mut env_pairs, "DRI_PRIME", "1");
    }

    for (key, value) in &config.environment.custom_vars {
        if is_protected_env_key(key) {
            continue;
        }
        upsert_env(&mut env_pairs, key, value);
    }

    Ok(LaunchCommandPlan {
        program,
        args,
        cwd: game_root.to_string_lossy().into_owned(),
        runtime: format!("{:?}", selected_runtime),
        env: env_pairs,
    })
}

fn execute_script_if_present(
    name: &str,
    script: &str,
    cwd: &str,
    env_pairs: &[(String, String)],
    dry_run: bool,
    mandatory: bool,
) -> Option<CommandExecutionResult> {
    if script.trim().is_empty() {
        return None;
    }

    let command = ExternalCommand {
        name: name.to_string(),
        program: "bash".to_string(),
        args: vec!["-lc".to_string(), script.to_string()],
        timeout_secs: Some(600),
        cwd: Some(cwd.to_string()),
        mandatory,
    };

    Some(execute_external_command(&command, env_pairs, dry_run))
}

fn validate_integrity(config: &GameConfig, game_root: &Path) -> anyhow::Result<Vec<String>> {
    let mut missing = Vec::new();

    let exe_path = resolve_relative_path(game_root, &config.relative_exe_path)
        .with_context(|| format!("invalid relative_exe_path '{}'", config.relative_exe_path))?;
    if !exe_path.exists() {
        missing.push(config.relative_exe_path.clone());
    }

    for file in &config.integrity_files {
        let path = resolve_relative_path(game_root, file)
            .with_context(|| format!("invalid path '{file}'"))?;
        if !path.exists() {
            missing.push(file.clone());
        }
    }

    Ok(missing)
}

fn resolve_game_root() -> anyhow::Result<PathBuf> {
    let current_exe = std::env::current_exe().context("failed to resolve current executable")?;
    let root = current_exe
        .parent()
        .ok_or_else(|| anyhow!("current executable has no parent directory"))?;
    Ok(root.to_path_buf())
}

fn resolve_relative_path(base: &Path, relative: &str) -> anyhow::Result<PathBuf> {
    let normalized = normalize_relative_payload_path(relative)?;
    Ok(base.join(normalized))
}

fn normalize_relative_payload_path(raw: &str) -> anyhow::Result<PathBuf> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("path is empty"));
    }

    let normalized = trimmed.replace('\\', "/");
    if normalized.starts_with('/') || has_windows_drive_prefix(&normalized) {
        return Err(anyhow!("absolute path is not allowed: {raw}"));
    }

    let mut out = PathBuf::new();
    for part in normalized.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }

        if part == ".." {
            return Err(anyhow!("path traversal is not allowed: {raw}"));
        }

        out.push(part);
    }

    if out.as_os_str().is_empty() {
        return Err(anyhow!("path resolves to empty value: {raw}"));
    }

    Ok(out)
}

fn has_windows_drive_prefix(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic()
}

fn feature_enabled(state: FeatureState) -> bool {
    matches!(state, FeatureState::MandatoryOn | FeatureState::OptionalOn)
}

fn feature_overridable(state: FeatureState) -> bool {
    matches!(state, FeatureState::OptionalOn | FeatureState::OptionalOff)
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

fn build_feature_view(
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

fn apply_toggle_request(
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

fn set_optional_override(target: &mut Option<bool>, requested: OptionalToggle) -> bool {
    let next = match requested {
        OptionalToggle::On => Some(true),
        OptionalToggle::Off => Some(false),
        OptionalToggle::Default => None,
    };

    let changed = *target != next;
    *target = next;
    changed
}

fn runtime_overrides_path(exe_hash: &str) -> anyhow::Result<PathBuf> {
    let home = std::env::var_os("HOME").ok_or_else(|| anyhow!("HOME is not set"))?;
    Ok(PathBuf::from(home)
        .join(".local/share/GameOrchestrator/overrides")
        .join(format!("{exe_hash}.json")))
}

fn load_runtime_overrides(exe_hash: &str) -> anyhow::Result<RuntimeOverrides> {
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

fn save_runtime_overrides(exe_hash: &str, overrides: &RuntimeOverrides) -> anyhow::Result<PathBuf> {
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

fn apply_runtime_overrides(config: &mut GameConfig, overrides: &RuntimeOverrides) {
    apply_optional_override(&mut config.requirements.mangohud, overrides.mangohud);
    apply_optional_override(&mut config.requirements.gamemode, overrides.gamemode);
    apply_optional_override(&mut config.environment.gamescope.state, overrides.gamescope);
    apply_optional_override(&mut config.requirements.gamescope, overrides.gamescope);
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

fn dependency_path(report: &DoctorReport, name: &str) -> Option<String> {
    report
        .dependencies
        .iter()
        .find(|dep| dep.name == name && dep.found)
        .and_then(|dep| dep.resolved_path.clone())
}

fn resolve_wrapper_executable(executable: &str) -> Option<String> {
    let path = Path::new(executable);
    if executable.contains('/') || path.is_absolute() {
        return is_executable_file(path).then(|| path.to_string_lossy().into_owned());
    }

    find_in_path(executable)
        .filter(|path| is_executable_file(path))
        .map(|path| path.to_string_lossy().into_owned())
}

fn find_in_path(bin_name: &str) -> Option<PathBuf> {
    let paths = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&paths) {
        let candidate = dir.join(bin_name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn is_executable_file(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::metadata(path)
            .map(|meta| meta.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
    }

    #[cfg(not(unix))]
    {
        true
    }
}

fn split_wrapper_args(raw: &str) -> Vec<String> {
    raw.split_whitespace().map(ToString::to_string).collect()
}

fn wrap_command(program: String, args: Vec<String>, inner: Vec<String>) -> Vec<String> {
    let mut out = Vec::with_capacity(1 + args.len() + inner.len());
    out.push(program);
    out.extend(args);
    out.extend(inner);
    out
}

fn split_program_and_args(tokens: Vec<String>) -> Option<(String, Vec<String>)> {
    let mut iter = tokens.into_iter();
    let program = iter.next()?;
    let args = iter.collect::<Vec<String>>();
    Some((program, args))
}

fn parse_resolution(raw: &str) -> Option<(u32, u32)> {
    let (w, h) = raw.split_once('x')?;
    let width = w.parse::<u32>().ok()?;
    let height = h.parse::<u32>().ok()?;
    Some((width, height))
}

fn upsert_env(
    env_pairs: &mut Vec<(String, String)>,
    key: impl Into<String>,
    value: impl Into<String>,
) {
    let key = key.into();
    let value = value.into();

    if let Some((_, existing_value)) = env_pairs
        .iter_mut()
        .find(|(existing_key, _)| existing_key == &key)
    {
        *existing_value = value;
        return;
    }

    env_pairs.push((key, value));
}

fn is_protected_env_key(key: &str) -> bool {
    matches!(key, "WINEPREFIX" | "PROTON_VERB")
}

fn dry_run_enabled() -> bool {
    std::env::var("GAME_ORCH_DRY_RUN")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

fn load_embedded_config_required() -> anyhow::Result<GameConfig> {
    let config = try_load_embedded_config()?;
    config.ok_or_else(|| anyhow!("embedded payload trailer not found"))
}

fn try_load_embedded_config() -> anyhow::Result<Option<GameConfig>> {
    let current_exe = std::env::current_exe().context("failed to resolve current executable")?;
    let binary = fs::read(&current_exe)
        .with_context(|| format!("failed to read executable at {}", current_exe.display()))?;

    let json_bytes = match extract_config_json(&binary) {
        Ok(bytes) => bytes,
        Err(OrchestratorError::TrailerNotFound | OrchestratorError::TrailerTruncated) => {
            return Ok(None);
        }
        Err(err) => return Err(anyhow!(err)),
    };

    let parsed: GameConfig =
        serde_json::from_slice(json_bytes).context("invalid embedded GameConfig")?;

    Ok(Some(parsed))
}

fn log_event(
    trace_id: &str,
    level: LogLevel,
    span_id: &str,
    code: &str,
    message: &str,
    context: serde_json::Value,
) {
    let event = LogEvent::new(
        level,
        code,
        message,
        LogIdentity::new(trace_id, span_id, "unknown", "orchestrator"),
        context,
    );

    let mut stderr = io::stderr();
    let _ = emit_ndjson(&mut stderr, &event);
}
