use std::{
    fs,
    path::{Path, PathBuf},
};

use anyhow::{anyhow, Context};
use orchestrator_core::{
    doctor::DoctorReport,
    prefix::base_env_for_prefix,
    process::{execute_external_command, CommandExecutionResult, ExternalCommand},
    FeatureState, GameConfig, RuntimeCandidate,
};
use serde::Serialize;

use crate::{overrides::feature_enabled, paths::resolve_relative_path};

#[derive(Debug, Serialize)]
pub struct LaunchCommandPlan {
    pub program: String,
    pub args: Vec<String>,
    pub cwd: String,
    pub runtime: String,
    pub env: Vec<(String, String)>,
}

pub fn build_launch_command(
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

    if config.environment.prime_offload.is_enabled() {
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

pub fn validate_integrity(config: &GameConfig, game_root: &Path) -> anyhow::Result<Vec<String>> {
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

pub fn dry_run_enabled() -> bool {
    std::env::var("GAME_ORCH_DRY_RUN")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
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
