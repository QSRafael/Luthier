use crate::application::winecfg_flow;
use anyhow::Context;

pub fn run_winecfg_command(trace_id: &str) -> anyhow::Result<()> {
    let execution = winecfg_flow::run_winecfg_flow(trace_id)?;

    println!(
        "{}",
        serde_json::to_string_pretty(&execution.output).context(execution.serialize_context)?
    );

    if let Some(err) = execution.terminal_error {
        return Err(err);
    }

    Ok(())
}
