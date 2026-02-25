use std::path::PathBuf;

use anyhow::{anyhow, Context};
use orchestrator_core::{
    doctor::{run_doctor, CheckStatus},
    observability::LogLevel,
    prefix::{base_env_for_prefix, build_prefix_setup_plan},
    process::{
        execute_external_command, execute_prefix_setup_plan, has_mandatory_failures,
        ExternalCommand, StepStatus,
    },
};

use crate::{
    instance_lock::acquire_instance_lock,
    launch::{
        build_launch_command, dry_run_enabled, effective_prefix_path_for_runtime,
        execute_script_if_present, validate_integrity,
    },
    logging::log_event,
    mounts::{apply_folder_mounts, MountStatus},
    overrides::{apply_runtime_overrides, load_runtime_overrides},
    paths::resolve_game_root,
    payload::load_embedded_config_required,
};

pub fn run_play(trace_id: &str) -> anyhow::Result<()> {
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

    let instance_lock = match acquire_instance_lock(&config.exe_hash) {
        Ok(lock) => lock,
        Err(err) => {
            let output = serde_json::json!({
                "lock": {
                    "status": "BLOCKER",
                    "error": err.to_string(),
                },
                "launch": {
                    "status": "aborted",
                    "reason": "another orchestrator instance is already running for this game",
                }
            });

            println!(
                "{}",
                serde_json::to_string_pretty(&output)
                    .context("failed to serialize lock failure output")?
            );

            return Err(err).context("failed to acquire game instance lock");
        }
    };

    log_event(
        trace_id,
        LogLevel::Info,
        "lock",
        "GO-LK-010",
        "instance_lock_acquired",
        serde_json::json!({
            "exe_hash": &config.exe_hash,
            "lock_path": instance_lock.lock_path().to_string_lossy(),
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
    let selected_runtime = report
        .runtime
        .selected_runtime
        .ok_or_else(|| anyhow!("doctor did not select a runtime"))?;
    let prefix_root_path = PathBuf::from(&prefix_plan.prefix_path);
    let effective_prefix_path = effective_prefix_path_for_runtime(&prefix_root_path, selected_runtime);
    let prefix_env = base_env_for_prefix(&effective_prefix_path);
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

    let mount_results =
        match apply_folder_mounts(&config, &game_root, &effective_prefix_path, dry_run) {
        Ok(results) => results,
        Err(err) => {
            let output = serde_json::json!({
                "doctor": report,
                "prefix_setup_plan": prefix_plan,
                "prefix_setup_execution": setup_results,
                "folder_mounts": {
                    "status": "failed",
                    "error": err.to_string(),
                },
                "launch": {
                    "status": "aborted",
                    "reason": "folder mount setup failed"
                }
            });

            println!(
                "{}",
                serde_json::to_string_pretty(&output)
                    .context("failed to serialize folder mount failure output")?
            );

            return Err(err).context("failed to apply folder mounts");
        }
    };

    let mounted_count = mount_results
        .iter()
        .filter(|result| matches!(result.status, MountStatus::Mounted))
        .count();
    let unchanged_count = mount_results
        .iter()
        .filter(|result| matches!(result.status, MountStatus::Unchanged))
        .count();
    let planned_count = mount_results
        .iter()
        .filter(|result| matches!(result.status, MountStatus::Planned))
        .count();

    log_event(
        trace_id,
        LogLevel::Info,
        "mounts",
        "GO-MT-020",
        "folder_mounts_applied",
        serde_json::json!({
            "configured": config.folder_mounts.len(),
            "results": mount_results.len(),
            "mounted": mounted_count,
            "unchanged": unchanged_count,
            "planned": planned_count,
            "dry_run": dry_run,
        }),
    );

    let launch_plan = build_launch_command(&config, &report, &game_root, &prefix_root_path)
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
                "folder_mounts": mount_results,
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
        "folder_mounts": mount_results,
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
