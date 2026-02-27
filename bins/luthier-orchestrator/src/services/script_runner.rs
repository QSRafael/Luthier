use crate::infrastructure::process_adapter::{
    execute_external_command, CommandExecutionResult, ExternalCommand,
};

pub fn execute_script_if_present(
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
