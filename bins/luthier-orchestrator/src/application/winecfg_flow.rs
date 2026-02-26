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
    launch::{
        apply_registry_keys_if_present, apply_winecfg_overrides_if_present,
        build_prefix_setup_execution_context, build_winecfg_command, dry_run_enabled,
    },
    logging::log_event,
    paths::resolve_game_root,
    payload::load_embedded_config_required,
};

#[derive(Debug)]
pub struct WinecfgFlowExecution {
    pub output: Value,
    pub terminal_error: Option<anyhow::Error>,
    pub serialize_context: &'static str,
}

impl WinecfgFlowExecution {
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

pub fn run_winecfg_flow(trace_id: &str) -> anyhow::Result<WinecfgFlowExecution> {
    execute_winecfg_flow(trace_id)
}

pub fn execute_winecfg_flow(trace_id: &str) -> anyhow::Result<WinecfgFlowExecution> {
    let config = load_embedded_config_required()?;
    let _game_root = resolve_game_root().context("failed to resolve game root")?;
    let dry_run = dry_run_enabled();

    let report = run_doctor(Some(&config));
    log_event(
        trace_id,
        LogLevel::Info,
        "winecfg",
        "GO-WC-010",
        "winecfg_doctor_finished",
        serde_json::json!({
            "summary": report.summary,
        }),
    );

    if matches!(report.summary, CheckStatus::BLOCKER) {
        let output = serde_json::json!({
            "doctor": report,
            "winecfg": {
                "status": "aborted",
                "reason": "doctor returned BLOCKER"
            }
        });

        return Ok(WinecfgFlowExecution::failed(
            output,
            anyhow!("doctor returned BLOCKER"),
            "failed to serialize doctor blocker",
        ));
    }

    let prefix_plan = build_prefix_setup_plan(&config).context("failed to build prefix plan")?;
    let prefix_setup = build_prefix_setup_execution_context(&config, &prefix_plan, &report)
        .context("failed to build runtime-aware prefix setup context")?;
    let setup_results = execute_prefix_setup_plan(&prefix_setup.plan, &prefix_setup.env, dry_run);

    if has_mandatory_failures(&setup_results) {
        let output = serde_json::json!({
            "doctor": report,
            "prefix_setup_plan": prefix_plan,
            "prefix_setup_execution": setup_results,
            "winecfg": {
                "status": "aborted",
                "reason": "mandatory prefix setup command failed"
            }
        });

        return Ok(WinecfgFlowExecution::failed(
            output,
            anyhow!("mandatory prefix setup step failed"),
            "failed to serialize prefix setup failure for winecfg",
        ));
    }

    let registry_apply_result =
        apply_registry_keys_if_present(&config, &report, &prefix_setup.prefix_root_path, dry_run)
            .context("failed to apply registry keys")?;

    let winecfg_apply_result = apply_winecfg_overrides_if_present(
        &config,
        &report,
        &prefix_setup.prefix_root_path,
        dry_run,
    )
    .context("failed to apply winecfg overrides")?;

    if let Some(result) = &winecfg_apply_result {
        if matches!(result.status, StepStatus::Failed | StepStatus::TimedOut) {
            let output = serde_json::json!({
                "doctor": report,
                "prefix_setup_plan": prefix_plan,
                "prefix_setup_execution": setup_results,
                "registry_apply": registry_apply_result,
                "winecfg_apply": result,
                "winecfg": {
                    "status": "aborted",
                    "reason": "winecfg override apply failed"
                }
            });

            return Ok(WinecfgFlowExecution::failed(
                output,
                anyhow!("winecfg override apply failed"),
                "failed to serialize winecfg apply failure output",
            ));
        }
    }

    let command_plan = build_winecfg_command(&config, &report, &prefix_setup.prefix_root_path)
        .context("failed to build winecfg command")?;

    log_event(
        trace_id,
        LogLevel::Info,
        "winecfg",
        "GO-WC-020",
        "winecfg_command_built",
        serde_json::json!({
            "program": command_plan.program,
            "args": command_plan.args,
            "runtime": command_plan.runtime,
            "dry_run": dry_run,
        }),
    );

    let result = execute_external_command(
        &ExternalCommand {
            name: "winecfg".to_string(),
            program: command_plan.program.clone(),
            args: command_plan.args.clone(),
            timeout_secs: None,
            cwd: Some(command_plan.cwd.clone()),
            mandatory: true,
        },
        &command_plan.env,
        dry_run,
    );

    let output = serde_json::json!({
        "doctor": report,
        "prefix_setup_plan": prefix_plan,
        "prefix_setup_execution": setup_results,
        "registry_apply": registry_apply_result,
        "winecfg_apply": winecfg_apply_result,
        "winecfg_command": command_plan,
        "winecfg_result": result,
    });

    Ok(WinecfgFlowExecution::completed(
        output,
        "failed to serialize winecfg command output",
    ))
}
