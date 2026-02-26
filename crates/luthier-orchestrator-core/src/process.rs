use std::fs;
use std::process::{Child, Command, ExitStatus, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

use crate::prefix::{PlannedCommand, PrefixSetupPlan};

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum StepStatus {
    Skipped,
    Success,
    Failed,
    TimedOut,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommandExecutionResult {
    pub name: String,
    pub program: String,
    pub args: Vec<String>,
    pub mandatory: bool,
    pub status: StepStatus,
    pub exit_code: Option<i32>,
    pub duration_ms: u128,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ExternalCommand {
    pub name: String,
    pub program: String,
    pub args: Vec<String>,
    pub timeout_secs: Option<u64>,
    pub cwd: Option<String>,
    pub mandatory: bool,
}

pub fn execute_prefix_setup_plan(
    plan: &PrefixSetupPlan,
    env_pairs: &[(String, String)],
    dry_run: bool,
) -> Vec<CommandExecutionResult> {
    if let Some(result) = ensure_prefix_directory(plan, dry_run) {
        return vec![result];
    }

    let mut results = Vec::new();
    let mut stop = false;

    for command in &plan.commands {
        if stop {
            results.push(skipped_result(
                command,
                "skipped due to prior mandatory failure",
            ));
            continue;
        }

        let result = if dry_run {
            skipped_result(command, "dry-run mode")
        } else {
            run_command(command, env_pairs)
        };

        let failed = matches!(result.status, StepStatus::Failed | StepStatus::TimedOut);
        if failed && result.mandatory {
            stop = true;
        }

        results.push(result);
    }

    results
}

fn ensure_prefix_directory(
    plan: &PrefixSetupPlan,
    dry_run: bool,
) -> Option<CommandExecutionResult> {
    if dry_run || !plan.needs_init {
        return None;
    }

    let start = Instant::now();
    if let Err(err) = fs::create_dir_all(&plan.prefix_path) {
        return Some(CommandExecutionResult {
            name: "prefix-dir-create".to_string(),
            program: "mkdir".to_string(),
            args: vec!["-p".to_string(), plan.prefix_path.clone()],
            mandatory: true,
            status: StepStatus::Failed,
            exit_code: None,
            duration_ms: start.elapsed().as_millis(),
            error: Some(format!("failed to create prefix directory: {err}")),
        });
    }

    None
}

pub fn has_mandatory_failures(results: &[CommandExecutionResult]) -> bool {
    results.iter().any(|result| {
        result.mandatory && matches!(result.status, StepStatus::Failed | StepStatus::TimedOut)
    })
}

pub fn execute_external_command(
    command: &ExternalCommand,
    env_pairs: &[(String, String)],
    dry_run: bool,
) -> CommandExecutionResult {
    if dry_run {
        return CommandExecutionResult {
            name: command.name.clone(),
            program: command.program.clone(),
            args: command.args.clone(),
            mandatory: command.mandatory,
            status: StepStatus::Skipped,
            exit_code: None,
            duration_ms: 0,
            error: Some("dry-run mode".to_string()),
        };
    }

    let start = Instant::now();
    let mut process = match spawn_external_process(command, env_pairs) {
        Ok(child) => child,
        Err(err) => {
            return CommandExecutionResult {
                name: command.name.clone(),
                program: command.program.clone(),
                args: command.args.clone(),
                mandatory: command.mandatory,
                status: StepStatus::Failed,
                exit_code: None,
                duration_ms: start.elapsed().as_millis(),
                error: Some(err.to_string()),
            }
        }
    };

    let wait_result = if let Some(timeout_secs) = command.timeout_secs {
        wait_with_timeout(&mut process, Duration::from_secs(timeout_secs))
    } else {
        process.wait().map(Some)
    };

    match wait_result {
        Ok(Some(status)) => CommandExecutionResult {
            name: command.name.clone(),
            program: command.program.clone(),
            args: command.args.clone(),
            mandatory: command.mandatory,
            status: if status.success() {
                StepStatus::Success
            } else {
                StepStatus::Failed
            },
            exit_code: status.code(),
            duration_ms: start.elapsed().as_millis(),
            error: None,
        },
        Ok(None) => CommandExecutionResult {
            name: command.name.clone(),
            program: command.program.clone(),
            args: command.args.clone(),
            mandatory: command.mandatory,
            status: StepStatus::TimedOut,
            exit_code: None,
            duration_ms: start.elapsed().as_millis(),
            error: Some(format!(
                "timeout after {}s",
                command.timeout_secs.unwrap_or_default()
            )),
        },
        Err(err) => CommandExecutionResult {
            name: command.name.clone(),
            program: command.program.clone(),
            args: command.args.clone(),
            mandatory: command.mandatory,
            status: StepStatus::Failed,
            exit_code: None,
            duration_ms: start.elapsed().as_millis(),
            error: Some(err.to_string()),
        },
    }
}

fn run_command(command: &PlannedCommand, env_pairs: &[(String, String)]) -> CommandExecutionResult {
    let start = Instant::now();

    let mut process = match spawn_process(command, env_pairs) {
        Ok(child) => child,
        Err(err) => {
            return CommandExecutionResult {
                name: command.name.clone(),
                program: command.program.clone(),
                args: command.args.clone(),
                mandatory: command.mandatory,
                status: StepStatus::Failed,
                exit_code: None,
                duration_ms: start.elapsed().as_millis(),
                error: Some(err.to_string()),
            }
        }
    };

    let timeout = Duration::from_secs(command.timeout_secs);
    match wait_with_timeout(&mut process, timeout) {
        Ok(Some(status)) => CommandExecutionResult {
            name: command.name.clone(),
            program: command.program.clone(),
            args: command.args.clone(),
            mandatory: command.mandatory,
            status: if status.success() {
                StepStatus::Success
            } else {
                StepStatus::Failed
            },
            exit_code: status.code(),
            duration_ms: start.elapsed().as_millis(),
            error: None,
        },
        Ok(None) => CommandExecutionResult {
            name: command.name.clone(),
            program: command.program.clone(),
            args: command.args.clone(),
            mandatory: command.mandatory,
            status: StepStatus::TimedOut,
            exit_code: None,
            duration_ms: start.elapsed().as_millis(),
            error: Some(format!("timeout after {}s", command.timeout_secs)),
        },
        Err(err) => CommandExecutionResult {
            name: command.name.clone(),
            program: command.program.clone(),
            args: command.args.clone(),
            mandatory: command.mandatory,
            status: StepStatus::Failed,
            exit_code: None,
            duration_ms: start.elapsed().as_millis(),
            error: Some(err.to_string()),
        },
    }
}

fn spawn_process(
    command: &PlannedCommand,
    env_pairs: &[(String, String)],
) -> Result<Child, std::io::Error> {
    let mut process = Command::new(&command.program);
    process
        .args(&command.args)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());

    for (key, value) in env_pairs {
        process.env(key, value);
    }

    process.spawn()
}

fn spawn_external_process(
    command: &ExternalCommand,
    env_pairs: &[(String, String)],
) -> Result<Child, std::io::Error> {
    let mut process = Command::new(&command.program);
    process
        .args(&command.args)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());

    if let Some(cwd) = &command.cwd {
        process.current_dir(cwd);
    }

    for (key, value) in env_pairs {
        process.env(key, value);
    }

    process.spawn()
}

fn wait_with_timeout(
    child: &mut Child,
    timeout: Duration,
) -> Result<Option<ExitStatus>, std::io::Error> {
    let started = Instant::now();

    loop {
        if let Some(status) = child.try_wait()? {
            return Ok(Some(status));
        }

        if started.elapsed() >= timeout {
            let _ = child.kill();
            let _ = child.wait();
            return Ok(None);
        }

        thread::sleep(Duration::from_millis(100));
    }
}

fn skipped_result(command: &PlannedCommand, reason: &str) -> CommandExecutionResult {
    CommandExecutionResult {
        name: command.name.clone(),
        program: command.program.clone(),
        args: command.args.clone(),
        mandatory: command.mandatory,
        status: StepStatus::Skipped,
        exit_code: None,
        duration_ms: 0,
        error: Some(reason.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::prefix::PrefixSetupPlan;

    #[test]
    fn dry_run_marks_steps_as_skipped() {
        let plan = PrefixSetupPlan {
            prefix_path: "/tmp/prefix".to_string(),
            needs_init: true,
            commands: vec![PlannedCommand {
                name: "dummy".to_string(),
                program: "echo".to_string(),
                args: vec!["hello".to_string()],
                timeout_secs: 1,
                mandatory: true,
            }],
            notes: vec![],
        };

        let results = execute_prefix_setup_plan(&plan, &[], true);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].status, StepStatus::Skipped);
    }

    #[test]
    fn dry_run_external_command_is_skipped() {
        let cmd = ExternalCommand {
            name: "pre-launch".to_string(),
            program: "bash".to_string(),
            args: vec!["-lc".to_string(), "echo test".to_string()],
            timeout_secs: Some(10),
            cwd: None,
            mandatory: true,
        };

        let result = execute_external_command(&cmd, &[], true);
        assert_eq!(result.status, StepStatus::Skipped);
        assert!(result.error.unwrap_or_default().contains("dry-run"));
    }
}
