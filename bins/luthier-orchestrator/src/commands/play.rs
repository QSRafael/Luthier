use crate::application::play_flow;
use anyhow::Context;

pub fn run_play(trace_id: &str) -> anyhow::Result<()> {
    let execution = play_flow::execute_play_flow(trace_id)?;

    println!(
        "{}",
        serde_json::to_string_pretty(&execution.output).context(execution.serialize_context)?
    );

    if let Some(err) = execution.terminal_error {
        return Err(err);
    }

    Ok(())
}
