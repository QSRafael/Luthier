use std::{
    collections::BTreeMap,
    fs,
    path::Component,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use anyhow::{anyhow, Context};
use luthier_orchestrator_core::{
    doctor::DoctorReport, DllOverrideRule, GameConfig, RuntimeCandidate, VirtualDesktopConfig,
    WineDesktopFolderMapping, WineDriveMapping, WinecfgConfig, WinecfgFeaturePolicy,
};
use sha2::{Digest, Sha256};

use crate::{
    infrastructure::{
        paths::resolve_relative_path,
        process_adapter::{
            execute_external_command, CommandExecutionResult, ExternalCommand, StepStatus,
        },
    },
    services::launch_plan_builder::{build_winecfg_command, effective_prefix_path_for_runtime},
};

pub fn apply_winecfg_overrides_if_present(
    config: &GameConfig,
    report: &DoctorReport,
    prefix_root_path: &Path,
    game_root: &Path,
    dry_run: bool,
) -> anyhow::Result<Option<CommandExecutionResult>> {
    let raw = render_winecfg_registry_overrides(&config.winecfg);
    let resolved_drives = resolve_active_drive_mappings(&config.winecfg.drives, game_root)
        .context("failed to resolve winecfg drive mappings from payload")?;
    let has_drive_overrides = !resolved_drives.is_empty();

    if raw.is_none() && !has_drive_overrides {
        return Ok(None);
    }

    let selected_runtime = report
        .runtime
        .selected_runtime
        .ok_or_else(|| anyhow!("doctor did not select a runtime"))?;
    let effective_prefix_path =
        effective_prefix_path_for_runtime(prefix_root_path, selected_runtime);

    let content_hash = build_winecfg_apply_hash(raw.as_deref(), &resolved_drives);
    if !dry_run && winecfg_import_cache_is_fresh(&effective_prefix_path, &content_hash) {
        return Ok(Some(cached_winecfg_apply_result()));
    }

    apply_winecfg_drive_mappings(&resolved_drives, &effective_prefix_path, dry_run).with_context(
        || {
            format!(
                "failed to apply winecfg drive mappings in '{}'",
                effective_prefix_path.display()
            )
        },
    )?;

    if let Some(raw_registry) = raw {
        let reg_windows_path = write_custom_reg_import_file(
            "go_winecfg_apply",
            &raw_registry,
            &effective_prefix_path,
        )?;
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
        return Ok(Some(result));
    }

    if !dry_run {
        let _ = write_winecfg_import_cache_hash(&effective_prefix_path, &content_hash);
    }

    Ok(Some(CommandExecutionResult {
        name: "winecfg-drive-apply".to_string(),
        program: "dosdevices".to_string(),
        args: resolved_drives
            .iter()
            .map(|drive| format!("{}:", drive.letter.to_ascii_lowercase()))
            .collect(),
        mandatory: true,
        status: if dry_run {
            StepStatus::Skipped
        } else {
            StepStatus::Success
        },
        exit_code: None,
        duration_ms: 0,
        error: if dry_run {
            Some("dry-run mode".to_string())
        } else {
            None
        },
    }))
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

fn build_winecfg_apply_hash(registry_raw: Option<&str>, drives: &[ResolvedDriveMapping]) -> String {
    let mut serialized = String::new();
    if let Some(raw) = registry_raw {
        serialized.push_str(raw);
    }
    serialized.push_str("\n--luthier-drive-mappings--\n");
    for drive in drives {
        serialized.push_str(&format!(
            "{}|{}|{}|{}|{}\n",
            drive.letter,
            drive.target_path.to_string_lossy(),
            drive.drive_type.as_deref().unwrap_or(""),
            drive.label.as_deref().unwrap_or(""),
            drive.serial.as_deref().unwrap_or(""),
        ));
    }
    sha256_hex(serialized.as_bytes())
}

#[derive(Debug, Clone)]
struct ResolvedDriveMapping {
    letter: char,
    target_path: PathBuf,
    drive_type: Option<String>,
    label: Option<String>,
    serial: Option<String>,
}

fn resolve_active_drive_mappings(
    drives: &[WineDriveMapping],
    game_root: &Path,
) -> anyhow::Result<Vec<ResolvedDriveMapping>> {
    let mut resolved = Vec::new();

    for drive in drives {
        if !drive.state.is_enabled() {
            continue;
        }

        let Some(letter) = normalize_drive_letter(&drive.letter) else {
            if drive.state.is_mandatory() {
                return Err(anyhow!(
                    "invalid drive letter '{}' in mandatory winecfg drive mapping",
                    drive.letter
                ));
            }
            continue;
        };

        if letter == 'C' {
            continue;
        }

        let Some(target_path) = resolve_drive_target_path(drive, game_root)? else {
            continue;
        };

        if !target_path.exists() {
            if drive.state.is_mandatory() {
                return Err(anyhow!(
                    "mandatory winecfg drive '{}:' target path does not exist: {}",
                    letter,
                    target_path.display()
                ));
            }
            continue;
        }

        resolved.push(ResolvedDriveMapping {
            letter,
            target_path,
            drive_type: normalize_drive_type_for_registry(drive.drive_type.as_deref())
                .map(ToString::to_string),
            label: drive
                .label
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToString::to_string),
            serial: drive
                .serial
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToString::to_string),
        });
    }

    resolved.sort_by_key(|item| item.letter);
    resolved.dedup_by(|a, b| a.letter == b.letter);
    Ok(resolved)
}

fn resolve_drive_target_path(
    drive: &WineDriveMapping,
    game_root: &Path,
) -> anyhow::Result<Option<PathBuf>> {
    if let Some(host_path) = drive
        .host_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let path = PathBuf::from(host_path);
        if path.is_absolute() {
            return Ok(Some(path));
        }
        if drive.state.is_mandatory() {
            return Err(anyhow!(
                "mandatory winecfg drive host_path must be absolute: '{}'",
                host_path
            ));
        }
        return Ok(None);
    }

    let source_relative = drive.source_relative_path.trim();
    if source_relative.is_empty() {
        if drive.state.is_mandatory() {
            return Err(anyhow!(
                "mandatory winecfg drive mapping must provide host_path or source_relative_path"
            ));
        }
        return Ok(None);
    }

    let is_dot = source_relative == "."
        || Path::new(source_relative)
            .components()
            .all(|component| component == Component::CurDir);
    if is_dot {
        if normalize_drive_letter(&drive.letter) == Some('Z') {
            return Ok(Some(PathBuf::from("/")));
        }
        return Ok(Some(game_root.to_path_buf()));
    }

    let relative = resolve_relative_path(game_root, source_relative).with_context(|| {
        format!(
            "invalid winecfg drive source_relative_path '{}'",
            source_relative
        )
    })?;
    Ok(Some(relative))
}

fn apply_winecfg_drive_mappings(
    drives: &[ResolvedDriveMapping],
    effective_prefix_path: &Path,
    dry_run: bool,
) -> anyhow::Result<()> {
    if drives.is_empty() || dry_run {
        return Ok(());
    }

    let dosdevices_dir = effective_prefix_path.join("dosdevices");
    fs::create_dir_all(&dosdevices_dir).with_context(|| {
        format!(
            "failed to create dosdevices directory '{}'",
            dosdevices_dir.display()
        )
    })?;

    for drive in drives {
        let link_path = dosdevices_dir.join(format!("{}:", drive.letter.to_ascii_lowercase()));
        replace_drive_symlink(&link_path, &drive.target_path)?;
    }

    Ok(())
}

fn replace_drive_symlink(link_path: &Path, target_path: &Path) -> anyhow::Result<()> {
    if let Ok(existing_target) = fs::read_link(link_path) {
        if existing_target == target_path {
            return Ok(());
        }
    }

    if let Ok(metadata) = fs::symlink_metadata(link_path) {
        if metadata.file_type().is_dir() {
            fs::remove_dir_all(link_path).with_context(|| {
                format!(
                    "failed to remove existing drive mapping '{}'",
                    link_path.display()
                )
            })?;
        } else {
            fs::remove_file(link_path).with_context(|| {
                format!(
                    "failed to remove existing drive mapping '{}'",
                    link_path.display()
                )
            })?;
        }
    }

    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(target_path, link_path).with_context(|| {
            format!(
                "failed to create drive mapping '{}' -> '{}'",
                link_path.display(),
                target_path.display()
            )
        })?;
    }
    #[cfg(not(unix))]
    {
        return Err(anyhow!(
            "winecfg drive mappings require unix symlink support on current platform"
        ));
    }

    Ok(())
}

fn normalize_drive_letter(raw: &str) -> Option<char> {
    let trimmed = raw.trim();
    let mut chars = trimmed.chars();
    let first = chars.next()?.to_ascii_uppercase();
    if chars.next().is_some() || !first.is_ascii_alphabetic() {
        return None;
    }
    Some(first)
}

fn normalize_drive_type_for_registry(raw: Option<&str>) -> Option<&'static str> {
    match raw.map(str::trim).map(str::to_ascii_lowercase).as_deref() {
        Some("local_disk") => Some("hd"),
        Some("network_share") => Some("network"),
        Some("floppy") => Some("floppy"),
        Some("cdrom") => Some("cdrom"),
        _ => None,
    }
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
    apply_winecfg_policy_toggle(
        &mut push_mutation,
        r"HKEY_CURRENT_USER\Software\Wine\FileOpenAssociations",
        "Enable",
        &winecfg.mime_associations,
    );

    apply_winecfg_virtual_desktop(&mut push_mutation, &winecfg.virtual_desktop);
    apply_winecfg_screen_dpi(&mut push_mutation, winecfg.screen_dpi);
    apply_winecfg_dll_overrides(&mut push_mutation, &winecfg.dll_overrides);
    apply_winecfg_desktop_folder_mappings(
        &mut push_mutation,
        &winecfg.desktop_integration,
        &winecfg.desktop_folders,
    );
    apply_winecfg_audio_driver(&mut push_mutation, winecfg.audio_driver.as_deref());
    apply_winecfg_drive_metadata(&mut push_mutation, &winecfg.drives);

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

fn apply_winecfg_desktop_folder_mappings<F>(
    push_mutation: &mut F,
    desktop_integration: &WinecfgFeaturePolicy,
    desktop_folders: &[WineDesktopFolderMapping],
) where
    F: FnMut(&str, &str, RegValueKind),
{
    let user_shell_key =
        r"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders";
    let shell_key =
        r"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders";

    let mut custom_mappings: Vec<(String, String)> = desktop_folders
        .iter()
        .filter_map(|item| {
            let name = map_desktop_folder_registry_name(&item.folder_key)?;
            let path = item.linux_path.trim();
            if path.is_empty() {
                return None;
            }
            Some((name.to_string(), path.to_string()))
        })
        .collect();
    custom_mappings.sort_by(|a, b| a.0.cmp(&b.0));
    custom_mappings.dedup_by(|a, b| a.0.eq_ignore_ascii_case(&b.0));

    let mut known_names = known_desktop_folder_registry_names()
        .iter()
        .map(ToString::to_string)
        .collect::<Vec<String>>();
    for (name, _) in &custom_mappings {
        if !known_names
            .iter()
            .any(|value| value.eq_ignore_ascii_case(name))
        {
            known_names.push(name.clone());
        }
    }

    if desktop_integration.use_wine_default || !desktop_integration.state.is_enabled() {
        for name in known_names {
            push_mutation(user_shell_key, &name, RegValueKind::Delete);
            push_mutation(shell_key, &name, RegValueKind::Delete);
        }
        return;
    }

    for (name, path) in custom_mappings {
        push_mutation(user_shell_key, &name, RegValueKind::String(path.clone()));
        push_mutation(shell_key, &name, RegValueKind::String(path));
    }
}

fn map_desktop_folder_registry_name(folder_key: &str) -> Option<&'static str> {
    match folder_key.trim().to_ascii_lowercase().as_str() {
        "desktop" => Some("Desktop"),
        "documents" => Some("Personal"),
        "downloads" => Some("{374DE290-123F-4565-9164-39C4925E467B}"),
        "music" => Some("My Music"),
        "pictures" => Some("My Pictures"),
        "videos" => Some("My Video"),
        _ => None,
    }
}

fn known_desktop_folder_registry_names() -> [&'static str; 6] {
    [
        "Desktop",
        "Personal",
        "{374DE290-123F-4565-9164-39C4925E467B}",
        "My Music",
        "My Pictures",
        "My Video",
    ]
}

fn apply_winecfg_audio_driver<F>(push_mutation: &mut F, audio_driver: Option<&str>)
where
    F: FnMut(&str, &str, RegValueKind),
{
    let key = r"HKEY_CURRENT_USER\Software\Wine\Drivers";
    let value_name = "Audio";
    match normalize_audio_driver_registry_value(audio_driver) {
        Some(driver) => push_mutation(key, value_name, RegValueKind::String(driver.to_string())),
        None => push_mutation(key, value_name, RegValueKind::Delete),
    }
}

fn normalize_audio_driver_registry_value(audio_driver: Option<&str>) -> Option<&'static str> {
    match audio_driver
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("pipewire") | Some("pulseaudio") => Some("winepulse.drv"),
        Some("alsa") => Some("winealsa.drv"),
        _ => None,
    }
}

fn apply_winecfg_drive_metadata<F>(push_mutation: &mut F, drives: &[WineDriveMapping])
where
    F: FnMut(&str, &str, RegValueKind),
{
    let key = r"HKEY_LOCAL_MACHINE\Software\Wine\Drives";
    for drive in drives {
        if !drive.state.is_enabled() {
            continue;
        }
        let Some(letter) = normalize_drive_letter(&drive.letter) else {
            continue;
        };
        if letter == 'C' {
            continue;
        }

        let value_name = format!("{letter}:");
        match normalize_drive_type_for_registry(drive.drive_type.as_deref()) {
            Some(drive_type) => {
                push_mutation(
                    key,
                    &value_name,
                    RegValueKind::String(drive_type.to_string()),
                );
            }
            None => {
                push_mutation(key, &value_name, RegValueKind::Delete);
            }
        }
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

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use luthier_orchestrator_core::FeatureState;

    use super::*;

    #[test]
    fn normalizes_audio_driver_registry_values_for_valid_and_invalid_inputs() {
        assert_eq!(
            normalize_audio_driver_registry_value(Some("pipewire")),
            Some("winepulse.drv")
        );
        assert_eq!(
            normalize_audio_driver_registry_value(Some(" PulseAudio ")),
            Some("winepulse.drv")
        );
        assert_eq!(
            normalize_audio_driver_registry_value(Some("alsa")),
            Some("winealsa.drv")
        );

        assert_eq!(normalize_audio_driver_registry_value(None), None);
        assert_eq!(normalize_audio_driver_registry_value(Some("  ")), None);
        assert_eq!(normalize_audio_driver_registry_value(Some("jack")), None);
    }

    #[test]
    fn normalizes_drive_letter_and_type_for_valid_and_invalid_inputs() {
        assert_eq!(normalize_drive_letter("d"), Some('D'));
        assert_eq!(normalize_drive_letter(" Z "), Some('Z'));
        assert_eq!(normalize_drive_letter("c"), Some('C'));

        assert_eq!(normalize_drive_letter(""), None);
        assert_eq!(normalize_drive_letter("1"), None);
        assert_eq!(normalize_drive_letter("AA"), None);

        assert_eq!(
            normalize_drive_type_for_registry(Some(" local_disk ")),
            Some("hd")
        );
        assert_eq!(
            normalize_drive_type_for_registry(Some("network_share")),
            Some("network")
        );
        assert_eq!(
            normalize_drive_type_for_registry(Some("floppy")),
            Some("floppy")
        );
        assert_eq!(
            normalize_drive_type_for_registry(Some("cdrom")),
            Some("cdrom")
        );
        assert_eq!(normalize_drive_type_for_registry(Some("ramdisk")), None);
        assert_eq!(normalize_drive_type_for_registry(None), None);
    }

    #[test]
    fn maps_desktop_folder_keys_to_registry_names() {
        assert_eq!(map_desktop_folder_registry_name("desktop"), Some("Desktop"));
        assert_eq!(
            map_desktop_folder_registry_name(" DOCUMENTS "),
            Some("Personal")
        );
        assert_eq!(
            map_desktop_folder_registry_name("downloads"),
            Some("{374DE290-123F-4565-9164-39C4925E467B}")
        );
        assert_eq!(map_desktop_folder_registry_name("music"), Some("My Music"));
        assert_eq!(
            map_desktop_folder_registry_name("pictures"),
            Some("My Pictures")
        );
        assert_eq!(map_desktop_folder_registry_name("videos"), Some("My Video"));

        assert_eq!(map_desktop_folder_registry_name("unknown"), None);
        assert_eq!(map_desktop_folder_registry_name(""), None);
    }

    #[test]
    fn winecfg_apply_hash_is_stable_and_changes_when_inputs_change() {
        let drives = vec![
            ResolvedDriveMapping {
                letter: 'D',
                target_path: PathBuf::from("/games/sample"),
                drive_type: Some("hd".to_string()),
                label: Some("GameDrive".to_string()),
                serial: Some("ABCD-1234".to_string()),
            },
            ResolvedDriveMapping {
                letter: 'Z',
                target_path: PathBuf::from("/"),
                drive_type: Some("network".to_string()),
                label: None,
                serial: None,
            },
        ];

        let hash_a = build_winecfg_apply_hash(Some("registry=v1"), &drives);
        let hash_b = build_winecfg_apply_hash(Some("registry=v1"), &drives);
        assert_eq!(hash_a, hash_b);
        assert_eq!(hash_a.len(), 64);
        assert!(hash_a.chars().all(|ch| ch.is_ascii_hexdigit()));

        let hash_registry_changed = build_winecfg_apply_hash(Some("registry=v2"), &drives);
        assert_ne!(hash_a, hash_registry_changed);

        let mut drives_serial_changed = drives.clone();
        drives_serial_changed[0].serial = Some("ABCD-9999".to_string());
        let hash_drive_changed =
            build_winecfg_apply_hash(Some("registry=v1"), &drives_serial_changed);
        assert_ne!(hash_a, hash_drive_changed);
    }

    #[test]
    fn resolves_active_drive_mappings_for_valid_scenarios() {
        let test_dir = create_test_dir("winecfg-drive-valid");
        let game_root = test_dir.path.join("game-root");
        fs::create_dir_all(&game_root).expect("create game_root");

        let host_dir = test_dir.path.join("host-drive");
        fs::create_dir_all(&host_dir).expect("create host drive path");

        let drives = vec![
            drive_mapping(
                "C",
                FeatureState::MandatoryOn,
                ".",
                Some(host_dir.to_string_lossy().as_ref()),
                Some("local_disk"),
                Some("ShouldBeSkipped"),
                None,
            ),
            drive_mapping(
                "d",
                FeatureState::MandatoryOn,
                "",
                Some(host_dir.to_string_lossy().as_ref()),
                Some(" local_disk "),
                Some("  Data Drive  "),
                Some("  AABB-CCDD  "),
            ),
            drive_mapping(
                "Z",
                FeatureState::OptionalOn,
                ".",
                None,
                Some("network_share"),
                None,
                None,
            ),
            drive_mapping(
                "1",
                FeatureState::OptionalOn,
                ".",
                None,
                Some("cdrom"),
                None,
                None,
            ),
            drive_mapping(
                "E",
                FeatureState::OptionalOff,
                ".",
                None,
                Some("floppy"),
                None,
                None,
            ),
        ];

        let resolved = resolve_active_drive_mappings(&drives, &game_root).expect("resolve drives");

        assert_eq!(resolved.len(), 2);
        assert_eq!(resolved[0].letter, 'D');
        assert_eq!(resolved[0].target_path, host_dir);
        assert_eq!(resolved[0].drive_type.as_deref(), Some("hd"));
        assert_eq!(resolved[0].label.as_deref(), Some("Data Drive"));
        assert_eq!(resolved[0].serial.as_deref(), Some("AABB-CCDD"));

        assert_eq!(resolved[1].letter, 'Z');
        assert_eq!(resolved[1].target_path, PathBuf::from("/"));
        assert_eq!(resolved[1].drive_type.as_deref(), Some("network"));
    }

    #[test]
    fn resolves_active_drive_mappings_returns_errors_for_mandatory_invalid_cases() {
        let test_dir = create_test_dir("winecfg-drive-errors");
        let game_root = test_dir.path.join("game-root");
        fs::create_dir_all(&game_root).expect("create game_root");

        let invalid_letter = vec![drive_mapping(
            "11",
            FeatureState::MandatoryOn,
            ".",
            None,
            None,
            None,
            None,
        )];
        let err = resolve_active_drive_mappings(&invalid_letter, &game_root)
            .expect_err("mandatory invalid letter must error");
        assert!(err.to_string().contains("invalid drive letter"));

        let relative_host_path = vec![drive_mapping(
            "D",
            FeatureState::MandatoryOn,
            "",
            Some("relative/path"),
            None,
            None,
            None,
        )];
        let err = resolve_active_drive_mappings(&relative_host_path, &game_root)
            .expect_err("mandatory relative host_path must error");
        assert!(err.to_string().contains("must be absolute"));

        let traversal_source = vec![drive_mapping(
            "E",
            FeatureState::MandatoryOn,
            "../outside",
            None,
            None,
            None,
            None,
        )];
        let err = resolve_active_drive_mappings(&traversal_source, &game_root)
            .expect_err("mandatory traversal in source_relative_path must error");
        assert!(err
            .to_string()
            .contains("invalid winecfg drive source_relative_path"));

        let missing_host_target = vec![drive_mapping(
            "F",
            FeatureState::MandatoryOn,
            "",
            Some("/tmp/luthier-does-not-exist-drive-target"),
            None,
            None,
            None,
        )];
        let err = resolve_active_drive_mappings(&missing_host_target, &game_root)
            .expect_err("mandatory target path that does not exist must error");
        assert!(err.to_string().contains("target path does not exist"));
    }

    fn drive_mapping(
        letter: &str,
        state: FeatureState,
        source_relative_path: &str,
        host_path: Option<&str>,
        drive_type: Option<&str>,
        label: Option<&str>,
        serial: Option<&str>,
    ) -> WineDriveMapping {
        WineDriveMapping {
            letter: letter.to_string(),
            source_relative_path: source_relative_path.to_string(),
            state,
            host_path: host_path.map(ToString::to_string),
            drive_type: drive_type.map(ToString::to_string),
            label: label.map(ToString::to_string),
            serial: serial.map(ToString::to_string),
        }
    }

    struct TestDir {
        path: PathBuf,
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    fn create_test_dir(label: &str) -> TestDir {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time should be monotonic")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "luthier-orchestrator-winecfg-apply-{label}-{}-{ts}",
            std::process::id()
        ));
        fs::create_dir_all(&path).expect("create test dir");
        TestDir { path }
    }
}
