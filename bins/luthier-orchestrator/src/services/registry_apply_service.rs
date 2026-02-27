use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use anyhow::{anyhow, Context};
use luthier_orchestrator_core::{
    doctor::DoctorReport,
    GameConfig, RegistryKey, RuntimeCandidate,
};
use sha2::{Digest, Sha256};

use crate::{
    infrastructure::process_adapter::{
        execute_external_command, CommandExecutionResult, ExternalCommand, StepStatus,
    },
    services::launch_plan_builder::{build_winecfg_command, effective_prefix_path_for_runtime},
};

pub fn apply_registry_keys_if_present(
    config: &GameConfig,
    report: &DoctorReport,
    prefix_root_path: &Path,
    dry_run: bool,
) -> anyhow::Result<Option<CommandExecutionResult>> {
    if config.registry_keys.is_empty() {
        return Ok(None);
    }

    let selected_runtime = report
        .runtime
        .selected_runtime
        .ok_or_else(|| anyhow!("doctor did not select a runtime"))?;
    let effective_prefix_path =
        effective_prefix_path_for_runtime(prefix_root_path, selected_runtime);

    let registry_content_hash = registry_keys_content_hash(&config.registry_keys);
    if !dry_run && registry_import_cache_is_fresh(&effective_prefix_path, &registry_content_hash) {
        return Ok(Some(cached_registry_import_result()));
    }

    let reg_windows_path = write_registry_import_file(&config.registry_keys, &effective_prefix_path)?;
    let command_plan =
        build_regedit_import_command(config, report, prefix_root_path, &reg_windows_path)
            .context("failed to build registry import command")?;

    let command = ExternalCommand {
        name: "registry-import".to_string(),
        program: command_plan.program,
        args: command_plan.args,
        timeout_secs: Some(120),
        cwd: Some(command_plan.cwd),
        mandatory: true,
    };

    let result = execute_external_command(&command, &command_plan.env, dry_run);

    if !dry_run && matches!(result.status, StepStatus::Success) {
        let _ = write_registry_import_cache_hash(&effective_prefix_path, &registry_content_hash);
    }

    Ok(Some(result))
}

#[derive(Debug, Clone)]
struct RegeditImportCommandPlan {
    program: String,
    args: Vec<String>,
    cwd: String,
    env: Vec<(String, String)>,
}

fn build_regedit_import_command(
    config: &GameConfig,
    report: &DoctorReport,
    prefix_root_path: &Path,
    reg_windows_path: &str,
) -> anyhow::Result<RegeditImportCommandPlan> {
    let selected_runtime = report
        .runtime
        .selected_runtime
        .ok_or_else(|| anyhow!("doctor did not select a runtime"))?;

    let mut command_tokens = match selected_runtime {
        RuntimeCandidate::ProtonUmu => {
            let umu = report
                .runtime
                .umu_run
                .clone()
                .ok_or_else(|| anyhow!("selected runtime ProtonUmu but umu-run path is missing"))?;
            vec![
                umu,
                "regedit.exe".to_string(),
                "/S".to_string(),
                reg_windows_path.to_string(),
            ]
        }
        RuntimeCandidate::ProtonNative => {
            let proton = report.runtime.proton.clone().ok_or_else(|| {
                anyhow!("selected runtime ProtonNative but proton path is missing")
            })?;
            vec![
                proton,
                "run".to_string(),
                "regedit.exe".to_string(),
                "/S".to_string(),
                reg_windows_path.to_string(),
            ]
        }
        RuntimeCandidate::Wine => {
            let wine = report
                .runtime
                .wine
                .clone()
                .ok_or_else(|| anyhow!("selected runtime Wine but wine path is missing"))?;
            let regedit_program = Path::new(&wine)
                .parent()
                .map(|parent| parent.join("regedit"))
                .filter(|candidate| candidate.exists())
                .map(|candidate| candidate.to_string_lossy().into_owned())
                .unwrap_or_else(|| "regedit".to_string());
            vec![
                regedit_program,
                "/S".to_string(),
                reg_windows_path.to_string(),
            ]
        }
    };

    let (program, args) = split_program_and_args(std::mem::take(&mut command_tokens))
        .ok_or_else(|| anyhow!("failed to build registry import command"))?;

    let mut env_pairs = build_winecfg_command(config, report, prefix_root_path)
        .context("failed to derive registry import env from runtime")?
        .env;

    Ok(RegeditImportCommandPlan {
        program,
        args,
        cwd: prefix_root_path.to_string_lossy().into_owned(),
        env: std::mem::take(&mut env_pairs),
    })
}

fn write_registry_import_file(
    registry_keys: &[RegistryKey],
    effective_prefix_path: &Path,
) -> anyhow::Result<String> {
    let temp_dir = effective_prefix_path.join("drive_c/windows/temp");
    fs::create_dir_all(&temp_dir).context("failed to create Windows temp directory inside prefix")?;

    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let file_name = format!("go_registry_import_{nonce}.reg");
    let file_path = temp_dir.join(&file_name);

    let raw = render_registry_file(registry_keys);
    let utf16 = encode_utf16le_with_bom(&raw);
    fs::write(&file_path, utf16).context("failed to write temporary .reg import file")?;

    Ok(format!(r"C:\windows\temp\{file_name}"))
}

fn registry_keys_content_hash(registry_keys: &[RegistryKey]) -> String {
    let raw = render_registry_file(registry_keys);
    sha256_hex(raw.as_bytes())
}

fn registry_import_cache_marker_path(cache_scope_path: &Path) -> PathBuf {
    cache_scope_path.join(".luthier_registry.sha256")
}

fn registry_import_cache_is_fresh(cache_scope_path: &Path, expected_hash: &str) -> bool {
    let path = registry_import_cache_marker_path(cache_scope_path);
    let Ok(saved) = fs::read_to_string(path) else {
        return false;
    };
    saved.trim() == expected_hash
}

fn write_registry_import_cache_hash(cache_scope_path: &Path, hash: &str) -> anyhow::Result<()> {
    let path = registry_import_cache_marker_path(cache_scope_path);
    fs::create_dir_all(cache_scope_path).with_context(|| {
        format!(
            "failed to create registry cache directory '{}'",
            cache_scope_path.display()
        )
    })?;
    fs::write(&path, format!("{hash}\n"))
        .with_context(|| format!("failed to write registry cache marker '{}'", path.display()))
}

fn cached_registry_import_result() -> CommandExecutionResult {
    CommandExecutionResult {
        name: "registry-import".to_string(),
        program: "regedit".to_string(),
        args: Vec::new(),
        mandatory: true,
        status: StepStatus::Skipped,
        exit_code: None,
        duration_ms: 0,
        error: Some("registry keys unchanged; skipped (cached)".to_string()),
    }
}

fn render_registry_file(registry_keys: &[RegistryKey]) -> String {
    let mut out = String::from("Windows Registry Editor Version 5.00\r\n\r\n");
    let mut current_path: Option<&str> = None;

    for key in registry_keys {
        if current_path != Some(key.path.as_str()) {
            if current_path.is_some() {
                out.push_str("\r\n");
            }
            out.push('[');
            out.push_str(&key.path);
            out.push_str("]\r\n");
            current_path = Some(key.path.as_str());
        }

        if let Some(line) = render_registry_key_line(key) {
            out.push_str(&line);
            out.push_str("\r\n");
        }
    }

    out
}

fn render_registry_key_line(key: &RegistryKey) -> Option<String> {
    let name = if key.name == "@" {
        "@".to_string()
    } else {
        format!("\"{}\"", escape_reg_string(&key.name))
    };

    let ty = key.value_type.trim().to_ascii_uppercase();
    let raw = key.value.trim();

    let rendered = match ty.as_str() {
        "REG_SZ" => format!("\"{}\"", escape_reg_string(raw)),
        "REG_DWORD" => {
            let value = raw.trim_start_matches("0x").to_ascii_lowercase();
            format!("dword:{value}")
        }
        "REG_BINARY" => format!("hex:{}", normalize_hex_for_reg(raw)),
        "REG_MULTI_SZ" => format!("hex(7):{}", normalize_hex_for_reg(raw)),
        "REG_EXPAND_SZ" => format!("hex(2):{}", normalize_hex_for_reg(raw)),
        "REG_QWORD" => format!("hex(b):{}", normalize_hex_for_reg(raw)),
        _ => return None,
    };

    Some(format!("{name}={rendered}"))
}

fn normalize_hex_for_reg(raw: &str) -> String {
    raw.split(',')
        .map(str::trim)
        .filter(|chunk| !chunk.is_empty())
        .collect::<Vec<_>>()
        .join(",")
}

fn escape_reg_string(raw: &str) -> String {
    raw.replace('\\', "\\\\").replace('"', "\\\"")
}

fn encode_utf16le_with_bom(raw: &str) -> Vec<u8> {
    let mut out = Vec::with_capacity(2 + raw.len() * 2);
    out.extend_from_slice(&[0xFF, 0xFE]);
    for unit in raw.encode_utf16() {
        out.extend_from_slice(&unit.to_le_bytes());
    }
    out
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn split_program_and_args(tokens: Vec<String>) -> Option<(String, Vec<String>)> {
    let mut iter = tokens.into_iter();
    let program = iter.next()?;
    let args = iter.collect::<Vec<String>>();
    Some((program, args))
}
