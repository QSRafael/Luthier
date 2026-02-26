use anyhow::{anyhow, Context};
use luthier_orchestrator_core::{
    doctor::{run_doctor, CheckStatus},
    observability::LogLevel,
    prefix::build_prefix_setup_plan,
    process::{
        execute_external_command, execute_prefix_setup_plan, has_mandatory_failures,
        ExternalCommand, StepStatus,
    },
};
use serde_json::Value;

use crate::{
    instance_lock::acquire_instance_lock,
    launch::{
        apply_registry_keys_if_present, apply_winecfg_overrides_if_present, build_launch_command,
        build_prefix_setup_execution_context, dry_run_enabled, execute_script_if_present,
        validate_integrity,
    },
    logging::log_event,
    mounts::{apply_folder_mounts, MountStatus},
    overrides::{apply_runtime_overrides, load_runtime_overrides},
    paths::{resolve_game_root, resolve_relative_path},
    payload::load_embedded_config_required,
};

#[derive(Debug)]
pub struct PlayFlowExecution {
    pub output: Value,
    pub terminal_error: Option<anyhow::Error>,
    pub serialize_context: &'static str,
}

impl PlayFlowExecution {
    fn completed(output: Value, serialize_context: &'static str) -> Self {
        Self {
            output,
            terminal_error: None,
            serialize_context,
        }
    }

    fn failed(
        output: Value,
        terminal_error: anyhow::Error,
        serialize_context: &'static str,
    ) -> Self {
        Self {
            output,
            terminal_error: Some(terminal_error),
            serialize_context,
        }
    }
}

pub fn execute_play_flow(trace_id: &str) -> anyhow::Result<PlayFlowExecution> {
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
                    "reason": "another luthier orchestrator instance is already running for this game",
                }
            });

            return Ok(PlayFlowExecution::failed(
                output,
                err.context("failed to acquire game instance lock"),
                "failed to serialize lock failure output",
            ));
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

    let game_exe_path = resolve_relative_path(&game_root, &config.relative_exe_path)
        .with_context(|| format!("invalid relative_exe_path '{}'", config.relative_exe_path))?;
    if !game_exe_path.exists() {
        let output = serde_json::json!({
            "integrity": {
                "status": "BLOCKER",
                "missing_files": [config.relative_exe_path.clone()],
                "missing_executable": config.relative_exe_path,
            },
            "launch": {
                "status": "aborted",
                "reason": "game executable is missing"
            }
        });

        return Ok(PlayFlowExecution::failed(
            output,
            anyhow!("game executable '{}' is missing", game_exe_path.display()),
            "failed to serialize missing executable error",
        ));
    }

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

        return Ok(PlayFlowExecution::failed(
            output,
            anyhow!("integrity check failed"),
            "failed to serialize integrity error",
        ));
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

        return Ok(PlayFlowExecution::failed(
            output,
            anyhow!("doctor returned BLOCKER"),
            "failed to serialize doctor blocker",
        ));
    }

    let prefix_plan = build_prefix_setup_plan(&config).context("failed to build prefix plan")?;
    let prefix_setup = build_prefix_setup_execution_context(&config, &prefix_plan, &report)
        .context("failed to build runtime-aware prefix setup context")?;
    let setup_results = execute_prefix_setup_plan(&prefix_setup.plan, &prefix_setup.env, dry_run);

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

        return Ok(PlayFlowExecution::failed(
            output,
            anyhow!("mandatory prefix setup step failed; launch aborted"),
            "failed to serialize prefix failure output",
        ));
    }

    let registry_apply_result =
        apply_registry_keys_if_present(&config, &report, &prefix_setup.prefix_root_path, dry_run)
            .context("failed to apply registry keys")?;

    if let Some(result) = &registry_apply_result {
        log_event(
            trace_id,
            LogLevel::Info,
            "registry",
            "GO-RG-020",
            "registry_keys_import_executed",
            serde_json::json!({
                "status": result.status,
                "exit_code": result.exit_code,
                "duration_ms": result.duration_ms,
                "entries": config.registry_keys.len(),
                "dry_run": dry_run,
            }),
        );

        if matches!(result.status, StepStatus::Failed | StepStatus::TimedOut) {
            let output = serde_json::json!({
                "doctor": report,
                "prefix_setup_plan": prefix_plan,
                "prefix_setup_execution": setup_results,
                "registry_apply": result,
                "launch": {
                    "status": "aborted",
                    "reason": "registry import failed"
                }
            });

            return Ok(PlayFlowExecution::failed(
                output,
                anyhow!("registry import failed"),
                "failed to serialize registry import failure",
            ));
        }
    }

    let winecfg_apply_result = apply_winecfg_overrides_if_present(
        &config,
        &report,
        &prefix_setup.prefix_root_path,
        dry_run,
    )
    .context("failed to apply winecfg overrides")?;

    if let Some(result) = &winecfg_apply_result {
        log_event(
            trace_id,
            LogLevel::Info,
            "winecfg",
            "GO-WC-030",
            "winecfg_overrides_applied",
            serde_json::json!({
                "status": result.status,
                "exit_code": result.exit_code,
                "duration_ms": result.duration_ms,
                "dry_run": dry_run,
            }),
        );

        if matches!(result.status, StepStatus::Failed | StepStatus::TimedOut) {
            let output = serde_json::json!({
                "doctor": report,
                "prefix_setup_plan": prefix_plan,
                "prefix_setup_execution": setup_results,
                "registry_apply": registry_apply_result,
                "winecfg_apply": result,
                "launch": {
                    "status": "aborted",
                    "reason": "winecfg override apply failed"
                }
            });

            return Ok(PlayFlowExecution::failed(
                output,
                anyhow!("winecfg override apply failed"),
                "failed to serialize winecfg apply failure",
            ));
        }
    }

    let mount_results = match apply_folder_mounts(
        &config,
        &game_root,
        &prefix_setup.effective_prefix_path,
        dry_run,
    ) {
        Ok(results) => results,
        Err(err) => {
            let output = serde_json::json!({
                "doctor": report,
                "prefix_setup_plan": prefix_plan,
                "prefix_setup_execution": setup_results,
                "registry_apply": registry_apply_result,
                "winecfg_apply": winecfg_apply_result,
                "folder_mounts": {
                    "status": "failed",
                    "error": err.to_string(),
                },
                "launch": {
                    "status": "aborted",
                    "reason": "folder mount setup failed"
                }
            });

            return Ok(PlayFlowExecution::failed(
                output,
                err.context("failed to apply folder mounts"),
                "failed to serialize folder mount failure output",
            ));
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

    let launch_plan =
        build_launch_command(&config, &report, &game_root, &prefix_setup.prefix_root_path)
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
                "registry_apply": registry_apply_result,
                "winecfg_apply": winecfg_apply_result,
                "folder_mounts": mount_results,
                "pre_launch": result,
                "launch": {
                    "status": "aborted",
                    "reason": "pre-launch script failed"
                }
            });

            return Ok(PlayFlowExecution::failed(
                output,
                anyhow!("pre-launch script failed"),
                "failed to serialize pre-launch failure",
            ));
        }
    }

    log_event(
        trace_id,
        LogLevel::Info,
        "launcher",
        "GO-LN-015",
        "game_command_starting",
        serde_json::json!({
            "program": &launch_plan.program,
            "args_count": launch_plan.args.len(),
            "cwd": &launch_plan.cwd,
        }),
    );

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
        "registry_apply": registry_apply_result,
        "winecfg_apply": winecfg_apply_result,
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

    if matches!(game_result.status, StepStatus::Failed | StepStatus::TimedOut) {
        return Ok(PlayFlowExecution::failed(
            output,
            anyhow!("game launch command failed"),
            "failed to serialize play output",
        ));
    }

    Ok(PlayFlowExecution::completed(
        output,
        "failed to serialize play output",
    ))
}
