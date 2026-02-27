use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use anyhow::{anyhow, Context};
use luthier_orchestrator_core::{
    doctor::DoctorReport,
    DllOverrideRule, GameConfig, RuntimeCandidate, VirtualDesktopConfig, WinecfgConfig,
    WinecfgFeaturePolicy,
};
use sha2::{Digest, Sha256};

use crate::{
    infrastructure::process_adapter::{
        execute_external_command, CommandExecutionResult, ExternalCommand, StepStatus,
    },
    services::launch_plan_builder::{build_winecfg_command, effective_prefix_path_for_runtime},
};

pub fn apply_winecfg_overrides_if_present(
    config: &GameConfig,
    report: &DoctorReport,
    prefix_root_path: &Path,
    dry_run: bool,
) -> anyhow::Result<Option<CommandExecutionResult>> {
    let Some(raw) = render_winecfg_registry_overrides(&config.winecfg) else {
        return Ok(None);
    };

    let selected_runtime = report
        .runtime
        .selected_runtime
        .ok_or_else(|| anyhow!("doctor did not select a runtime"))?;
    let effective_prefix_path =
        effective_prefix_path_for_runtime(prefix_root_path, selected_runtime);

    let content_hash = sha256_hex(raw.as_bytes());
    if !dry_run && winecfg_import_cache_is_fresh(&effective_prefix_path, &content_hash) {
        return Ok(Some(cached_winecfg_apply_result()));
    }

    let reg_windows_path =
        write_custom_reg_import_file("go_winecfg_apply", &raw, &effective_prefix_path)?;
    let command_plan =
        build_regedit_import_command(config, report, prefix_root_path, &reg_windows_path)
            .context("failed to build winecfg registry import command")?;

    let command = ExternalCommand {
        name: "winecfg-registry-apply".to_string(),
        program: command_plan.program,
        args: command_plan.args,
        timeout_secs: Some(120),
        cwd: Some(command_plan.cwd),
        mandatory: true,
    };

    let result = execute_external_command(&command, &command_plan.env, dry_run);
    if !dry_run && matches!(result.status, StepStatus::Success) {
        let _ = write_winecfg_import_cache_hash(&effective_prefix_path, &content_hash);
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
            let umu =
                report.runtime.umu_run.clone().ok_or_else(|| {
                    anyhow!("selected runtime ProtonUmu but umu-run path is missing")
                })?;
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

    // The `winecfg` helper already adds protected env keys. We only need command/env.
    Ok(RegeditImportCommandPlan {
        program,
        args,
        cwd: prefix_root_path.to_string_lossy().into_owned(),
        env: std::mem::take(&mut env_pairs),
    })
}

fn write_custom_reg_import_file(
    prefix: &str,
    raw: &str,
    effective_prefix_path: &Path,
) -> anyhow::Result<String> {
    let temp_dir = effective_prefix_path.join("drive_c/windows/temp");
    fs::create_dir_all(&temp_dir)
        .context("failed to create Windows temp directory inside prefix")?;

    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let file_name = format!("{prefix}_{nonce}.reg");
    let file_path = temp_dir.join(&file_name);

    let utf16 = encode_utf16le_with_bom(raw);
    fs::write(&file_path, utf16).context("failed to write temporary .reg import file")?;

    Ok(format!(r"C:\windows\temp\{file_name}"))
}

fn winecfg_import_cache_marker_path(cache_scope_path: &Path) -> PathBuf {
    cache_scope_path.join(".luthier_winecfg.sha256")
}

fn winecfg_import_cache_is_fresh(cache_scope_path: &Path, expected_hash: &str) -> bool {
    let path = winecfg_import_cache_marker_path(cache_scope_path);
    let Ok(saved) = fs::read_to_string(path) else {
        return false;
    };
    saved.trim() == expected_hash
}

fn write_winecfg_import_cache_hash(cache_scope_path: &Path, hash: &str) -> anyhow::Result<()> {
    let path = winecfg_import_cache_marker_path(cache_scope_path);
    fs::create_dir_all(cache_scope_path).with_context(|| {
        format!(
            "failed to create winecfg cache directory '{}'",
            cache_scope_path.display()
        )
    })?;
    fs::write(&path, format!("{hash}\n"))
        .with_context(|| format!("failed to write winecfg cache marker '{}'", path.display()))
}

fn cached_winecfg_apply_result() -> CommandExecutionResult {
    CommandExecutionResult {
        name: "winecfg-registry-apply".to_string(),
        program: "regedit".to_string(),
        args: Vec::new(),
        mandatory: true,
        status: StepStatus::Skipped,
        exit_code: None,
        duration_ms: 0,
        error: Some("winecfg overrides unchanged; skipped (cached)".to_string()),
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

#[derive(Debug, Clone)]
enum RegValueKind {
    String(String),
    Dword(u32),
    Delete,
}

#[derive(Debug, Clone)]
struct RegMutation {
    name: String,
    kind: RegValueKind,
}

fn render_winecfg_registry_overrides(winecfg: &WinecfgConfig) -> Option<String> {
    let mut sections: BTreeMap<String, Vec<RegMutation>> = BTreeMap::new();

    let mut push_mutation = |path: &str, name: &str, kind: RegValueKind| {
        sections
            .entry(path.to_string())
            .or_default()
            .push(RegMutation {
                name: name.to_string(),
                kind,
            });
    };

    if let Some(version) = winecfg
        .windows_version
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
    {
        push_mutation(
            r"HKEY_CURRENT_USER\Software\Wine",
            "Version",
            RegValueKind::String(version.to_string()),
        );
    } else {
        push_mutation(
            r"HKEY_CURRENT_USER\Software\Wine",
            "Version",
            RegValueKind::Delete,
        );
    }

    apply_winecfg_policy_toggle(
        &mut push_mutation,
        r"HKEY_CURRENT_USER\Software\Wine\X11 Driver",
        "GrabFullscreen",
        &winecfg.auto_capture_mouse,
    );
    apply_winecfg_policy_toggle(
        &mut push_mutation,
        r"HKEY_CURRENT_USER\Software\Wine\X11 Driver",
        "Decorated",
        &winecfg.window_decorations,
    );
    apply_winecfg_policy_toggle(
        &mut push_mutation,
        r"HKEY_CURRENT_USER\Software\Wine\X11 Driver",
        "Managed",
        &winecfg.window_manager_control,
    );

    apply_winecfg_virtual_desktop(&mut push_mutation, &winecfg.virtual_desktop);
    apply_winecfg_screen_dpi(&mut push_mutation, winecfg.screen_dpi);
    apply_winecfg_dll_overrides(&mut push_mutation, &winecfg.dll_overrides);

    if sections.is_empty() {
        return None;
    }

    Some(render_custom_registry_file(&sections))
}

fn apply_winecfg_policy_toggle<F>(
    push_mutation: &mut F,
    path: &str,
    name: &str,
    policy: &WinecfgFeaturePolicy,
) where
    F: FnMut(&str, &str, RegValueKind),
{
    if policy.use_wine_default {
        push_mutation(path, name, RegValueKind::Delete);
        return;
    }

    let value = if policy.state.is_enabled() { "Y" } else { "N" };
    push_mutation(path, name, RegValueKind::String(value.to_string()));
}

fn apply_winecfg_virtual_desktop<F>(push_mutation: &mut F, virtual_desktop: &VirtualDesktopConfig)
where
    F: FnMut(&str, &str, RegValueKind),
{
    let explorer_key = r"HKEY_CURRENT_USER\Software\Wine\Explorer";
    let desktops_key = r"HKEY_CURRENT_USER\Software\Wine\Explorer\Desktops";

    if virtual_desktop.state.use_wine_default || !virtual_desktop.state.state.is_enabled() {
        push_mutation(explorer_key, "Desktop", RegValueKind::Delete);
        push_mutation(desktops_key, "Default", RegValueKind::Delete);
        return;
    }

    let Some(resolution) = virtual_desktop
        .resolution
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
    else {
        return;
    };

    push_mutation(
        explorer_key,
        "Desktop",
        RegValueKind::String("Default".to_string()),
    );
    push_mutation(
        desktops_key,
        "Default",
        RegValueKind::String(resolution.to_string()),
    );
}

fn apply_winecfg_screen_dpi<F>(push_mutation: &mut F, dpi: Option<u16>)
where
    F: FnMut(&str, &str, RegValueKind),
{
    let key = r"HKEY_CURRENT_USER\Control Panel\Desktop";
    if let Some(value) = dpi {
        push_mutation(key, "LogPixels", RegValueKind::Dword(u32::from(value)));
    } else {
        push_mutation(key, "LogPixels", RegValueKind::Delete);
    }
}

fn apply_winecfg_dll_overrides<F>(push_mutation: &mut F, dll_overrides: &[DllOverrideRule])
where
    F: FnMut(&str, &str, RegValueKind),
{
    let key = r"HKEY_CURRENT_USER\Software\Wine\DllOverrides";
    let mut normalized = dll_overrides
        .iter()
        .filter_map(|rule| {
            let dll = rule
                .dll
                .trim()
                .trim_end_matches(".dll")
                .trim()
                .to_ascii_lowercase();
            let mode = rule.mode.trim();
            if dll.is_empty() || mode.is_empty() {
                return None;
            }
            Some((dll, mode.to_string()))
        })
        .collect::<Vec<_>>();

    normalized.sort_by(|a, b| a.0.cmp(&b.0));
    normalized.dedup_by(|a, b| a.0 == b.0);

    for (dll, mode) in normalized {
        push_mutation(key, &dll, RegValueKind::String(mode));
    }
}

fn render_custom_registry_file(sections: &BTreeMap<String, Vec<RegMutation>>) -> String {
    let mut out = String::from("Windows Registry Editor Version 5.00\r\n\r\n");

    let mut first_section = true;
    for (path, mutations) in sections {
        if mutations.is_empty() {
            continue;
        }
        if !first_section {
            out.push_str("\r\n");
        }
        first_section = false;

        out.push('[');
        out.push_str(path);
        out.push_str("]\r\n");

        let mut sorted = mutations.clone();
        sorted.sort_by(|a, b| a.name.cmp(&b.name));

        for mutation in sorted {
            out.push_str(&render_custom_registry_line(&mutation));
            out.push_str("\r\n");
        }
    }

    out
}

fn render_custom_registry_line(mutation: &RegMutation) -> String {
    let name = if mutation.name == "@" {
        "@".to_string()
    } else {
        format!("\"{}\"", escape_reg_string(&mutation.name))
    };

    let rendered = match &mutation.kind {
        RegValueKind::String(value) => format!("\"{}\"", escape_reg_string(value)),
        RegValueKind::Dword(value) => format!("dword:{value:08x}"),
        RegValueKind::Delete => "-".to_string(),
    };

    format!("{name}={rendered}")
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

fn split_program_and_args(tokens: Vec<String>) -> Option<(String, Vec<String>)> {
    let mut iter = tokens.into_iter();
    let program = iter.next()?;
    let args = iter.collect::<Vec<String>>();
    Some((program, args))
}
