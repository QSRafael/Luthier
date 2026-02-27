use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;

use anyhow::Context;

#[derive(Debug)]
pub(crate) enum ChildProcessStream {
    Stdout,
    Stderr,
}

#[derive(Debug)]
pub(crate) enum ChildProcessEvent {
    Line(ChildProcessStream, String),
    Exited(Option<i32>),
}

pub(crate) fn spawn_play_child(tx: mpsc::Sender<ChildProcessEvent>) -> anyhow::Result<()> {
    let current_exe = std::env::current_exe().context("failed to locate current executable")?;
    let mut child = Command::new(&current_exe)
        .arg("--play")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .with_context(|| format!("failed to spawn '{}' --play", current_exe.display()))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    if let Some(stdout) = stdout {
        let tx_out = tx.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        let _ =
                            tx_out.send(ChildProcessEvent::Line(ChildProcessStream::Stdout, line));
                    }
                    Err(err) => {
                        let _ = tx_out.send(ChildProcessEvent::Line(
                            ChildProcessStream::Stdout,
                            format!("(stdout read error: {err})"),
                        ));
                        break;
                    }
                }
            }
        });
    }

    if let Some(stderr) = stderr {
        let tx_err = tx.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        let _ =
                            tx_err.send(ChildProcessEvent::Line(ChildProcessStream::Stderr, line));
                    }
                    Err(err) => {
                        let _ = tx_err.send(ChildProcessEvent::Line(
                            ChildProcessStream::Stderr,
                            format!("(stderr read error: {err})"),
                        ));
                        break;
                    }
                }
            }
        });
    }

    thread::spawn(move || {
        let code = child.wait().ok().and_then(|status| status.code());
        let _ = tx.send(ChildProcessEvent::Exited(code));
    });

    Ok(())
}
