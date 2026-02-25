use std::collections::BTreeSet;
use std::env;
use std::fs;
use std::io::{Cursor, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::{engine::general_purpose, Engine as _};
use creator_core::{create_orchestrator_binary, sha256_file, CreateOrchestratorRequest};
use image::{DynamicImage, GenericImageView, ImageFormat};
use orchestrator_core::{
    doctor::run_doctor, prefix::build_prefix_setup_plan, GameConfig, RegistryKey,
};
use pelite::pe32::Pe as _;
use pelite::pe64::Pe as _;
use pelite::{pe32, pe64};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateExecutableInput {
    pub base_binary_path: String,
    pub output_path: String,
    pub config_json: String,
    pub backup_existing: bool,
    pub make_executable: bool,
    #[serde(default)]
    pub icon_png_data_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateExecutableOutput {
    pub output_path: String,
    pub config_size_bytes: usize,
    pub config_sha256_hex: String,
    pub resolved_base_binary_path: String,
    pub icon_sidecar_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HashExeInput {
    pub executable_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HashExeOutput {
    pub sha256_hex: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExtractExecutableIconInput {
    pub executable_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExtractExecutableIconOutput {
    pub data_url: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestConfigurationInput {
    pub config_json: String,
    pub game_root: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestConfigurationOutput {
    pub status: String,
    pub missing_files: Vec<String>,
    pub doctor: serde_json::Value,
    pub prefix_setup_plan: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WinetricksAvailableOutput {
    pub source: String,
    pub components: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportRegistryFileInput {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportRegistryFileOutput {
    pub entries: Vec<RegistryKey>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ListChildDirectoriesInput {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ListChildDirectoriesOutput {
    pub path: String,
    pub directories: Vec<String>,
}

pub fn create_executable(input: CreateExecutableInput) -> Result<CreateExecutableOutput, String> {
    create_executable_with_base_hints(input, &[])
}

pub fn create_executable_with_base_hints(
    input: CreateExecutableInput,
    base_binary_hints: &[PathBuf],
) -> Result<CreateExecutableOutput, String> {
    log_backend_event(
        "INFO",
        "GO-CR-001",
        "create_executable_requested",
        serde_json::json!({
            "requested_base_binary_path": input.base_binary_path,
            "output_path": input.output_path,
            "backup_existing": input.backup_existing,
            "make_executable": input.make_executable,
            "has_icon_png_data_url": input.icon_png_data_url.as_ref().is_some_and(|value| !value.trim().is_empty()),
            "hints_count": base_binary_hints.len(),
        }),
    );

    let config: GameConfig = serde_json::from_str(&input.config_json)
        .map_err(|err| format!("invalid config JSON: {err}"))?;
    let resolved_base_binary_path =
        resolve_base_orchestrator_binary(&input.base_binary_path, base_binary_hints)?;

    log_backend_event(
        "INFO",
        "GO-CR-010",
        "base_orchestrator_binary_resolved",
        serde_json::json!({
            "resolved_base_binary_path": resolved_base_binary_path,
        }),
    );

    let request = CreateOrchestratorRequest {
        base_binary_path: resolved_base_binary_path.clone(),
        output_path: PathBuf::from(input.output_path),
        config,
        backup_existing: input.backup_existing,
        make_executable: input.make_executable,
    };

    let result = create_orchestrator_binary(&request).map_err(|err| {
        let message = err.to_string();
        log_backend_event(
            "ERROR",
            "GO-CR-090",
            "create_executable_failed",
            serde_json::json!({
                "error": message,
                "base_binary_path": request.base_binary_path,
                "output_path": request.output_path,
            }),
        );
        message
    })?;

    let icon_sidecar_path = match input.icon_png_data_url.as_deref() {
        Some(data_url) if !data_url.trim().is_empty() => {
            Some(write_icon_sidecar_png(&request.output_path, data_url)?)
        }
        _ => None,
    };

    log_backend_event(
        "INFO",
        "GO-CR-020",
        "create_executable_completed",
        serde_json::json!({
            "output_path": result.output_path,
            "config_size_bytes": result.config_size_bytes,
            "config_sha256_hex": result.config_sha256_hex,
            "resolved_base_binary_path": resolved_base_binary_path,
            "icon_sidecar_path": icon_sidecar_path,
        }),
    );

    Ok(CreateExecutableOutput {
        output_path: result.output_path,
        config_size_bytes: result.config_size_bytes,
        config_sha256_hex: result.config_sha256_hex,
        resolved_base_binary_path: request.base_binary_path.to_string_lossy().into_owned(),
        icon_sidecar_path,
    })
}

pub fn hash_executable(input: HashExeInput) -> Result<HashExeOutput, String> {
    let path = PathBuf::from(input.executable_path);
    log_backend_event(
        "INFO",
        "GO-CR-101",
        "hash_executable_requested",
        serde_json::json!({ "path": path }),
    );
    let hash = sha256_file(&path).map_err(|err| err.to_string())?;
    log_backend_event(
        "INFO",
        "GO-CR-102",
        "hash_executable_completed",
        serde_json::json!({ "path": path, "sha256_hex": hash }),
    );

    Ok(HashExeOutput { sha256_hex: hash })
}

pub fn extract_executable_icon(
    input: ExtractExecutableIconInput,
) -> Result<ExtractExecutableIconOutput, String> {
    let path = PathBuf::from(&input.executable_path);
    log_backend_event(
        "INFO",
        "GO-CR-111",
        "extract_executable_icon_requested",
        serde_json::json!({ "path": path }),
    );

    let bytes = fs::read(&path).map_err(|err| format!("failed to read executable: {err}"))?;
    let (png_bytes, width, height) = extract_best_exe_icon_png(&bytes)?;
    let data_url = format!(
        "data:image/png;base64,{}",
        general_purpose::STANDARD.encode(&png_bytes)
    );

    log_backend_event(
        "INFO",
        "GO-CR-112",
        "extract_executable_icon_completed",
        serde_json::json!({
            "path": path,
            "width": width,
            "height": height,
            "png_size_bytes": png_bytes.len(),
        }),
    );

    Ok(ExtractExecutableIconOutput {
        data_url,
        width,
        height,
    })
}

pub fn test_configuration(
    input: TestConfigurationInput,
) -> Result<TestConfigurationOutput, String> {
    log_backend_event(
        "INFO",
        "GO-CR-201",
        "test_configuration_requested",
        serde_json::json!({
            "game_root": input.game_root,
            "config_json_len": input.config_json.len(),
        }),
    );
    let config: GameConfig = serde_json::from_str(&input.config_json)
        .map_err(|err| format!("invalid config JSON: {err}"))?;

    creator_core::validate_game_config_relative_paths(&config).map_err(|err| err.to_string())?;

    let game_root = PathBuf::from(&input.game_root);
    let missing_files = collect_missing_files(&config, &game_root)?;
    let doctor = run_doctor(Some(&config));
    let prefix_plan = build_prefix_setup_plan(&config).map_err(|err| err.to_string())?;

    let has_blocker = matches!(
        doctor.summary,
        orchestrator_core::doctor::CheckStatus::BLOCKER
    );
    let status = if has_blocker || !missing_files.is_empty() {
        "BLOCKER"
    } else {
        "OK"
    };

    let out = TestConfigurationOutput {
        status: status.to_string(),
        missing_files,
        doctor: serde_json::to_value(doctor).map_err(|err| err.to_string())?,
        prefix_setup_plan: serde_json::to_value(prefix_plan).map_err(|err| err.to_string())?,
    };

    log_backend_event(
        "INFO",
        "GO-CR-202",
        "test_configuration_completed",
        serde_json::json!({
            "status": out.status,
            "missing_files_count": out.missing_files.len(),
        }),
    );

    Ok(out)
}

fn extract_best_exe_icon_png(exe_bytes: &[u8]) -> Result<(Vec<u8>, u32, u32), String> {
    let icons = read_all_pe_icon_groups(exe_bytes)?;
    if icons.is_empty() {
        return Err("no icon resources found in executable".to_string());
    }

    let mut best_image: Option<DynamicImage> = None;
    let mut best_area = 0u64;

    for icon_bytes in icons {
        let decoded = match image::load_from_memory_with_format(&icon_bytes, ImageFormat::Ico) {
            Ok(image) => image,
            Err(_) => continue,
        };

        let (width, height) = decoded.dimensions();
        let area = u64::from(width) * u64::from(height);
        if area > best_area {
            best_area = area;
            best_image = Some(decoded);
        }
    }

    let Some(mut image) = best_image else {
        return Err("failed to decode icon resources to image".to_string());
    };

    // Keep the preview sidecar reasonably small while preserving detail.
    if image.width() > 256 || image.height() > 256 {
        image = image.thumbnail(256, 256);
    }

    let (width, height) = image.dimensions();
    let mut png_bytes = Vec::new();
    let mut cursor = Cursor::new(&mut png_bytes);
    image
        .write_to(&mut cursor, ImageFormat::Png)
        .map_err(|err| format!("failed to encode PNG icon: {err}"))?;

    Ok((png_bytes, width, height))
}

trait PeResourcesProvider {
    fn get_resources(&self) -> Result<pelite::resources::Resources<'_>, pelite::Error>;
}

impl PeResourcesProvider for pe32::PeFile<'_> {
    fn get_resources(&self) -> Result<pelite::resources::Resources<'_>, pelite::Error> {
        self.resources()
    }
}

impl PeResourcesProvider for pe64::PeFile<'_> {
    fn get_resources(&self) -> Result<pelite::resources::Resources<'_>, pelite::Error> {
        self.resources()
    }
}

fn read_all_pe_icon_groups(exe_bytes: &[u8]) -> Result<Vec<Vec<u8>>, String> {
    with_pe_resources(exe_bytes, |pe| {
        let resources = pe
            .get_resources()
            .map_err(|err| format!("no PE resources found: {err}"))?;

        let mut out = Vec::<Vec<u8>>::new();
        for entry in resources.icons().flatten() {
            let (_name, group) = entry;
            let mut bytes = Vec::new();
            if group.write(&mut bytes).is_ok() && !bytes.is_empty() {
                out.push(bytes);
            }
        }
        Ok(out)
    })
}

fn with_pe_resources<T, F>(exe_bytes: &[u8], f: F) -> Result<T, String>
where
    F: FnOnce(&dyn PeResourcesProvider) -> Result<T, String>,
{
    if pe_is_64(exe_bytes)? {
        let pe = pe64::PeFile::from_bytes(exe_bytes)
            .map_err(|err| format!("failed to parse PE64 executable: {err}"))?;
        f(&pe)
    } else {
        let pe = pe32::PeFile::from_bytes(exe_bytes)
            .map_err(|err| format!("failed to parse PE32 executable: {err}"))?;
        f(&pe)
    }
}

fn pe_is_64(bin: &[u8]) -> Result<bool, String> {
    let mut file = Cursor::new(bin);

    file.seek(SeekFrom::Start(0x3C))
        .map_err(|err| format!("failed to seek DOS header: {err}"))?;
    let mut e_lfanew_bytes = [0u8; 4];
    file.read_exact(&mut e_lfanew_bytes)
        .map_err(|err| format!("failed to read e_lfanew: {err}"))?;
    let e_lfanew = u32::from_le_bytes(e_lfanew_bytes);

    file.seek(SeekFrom::Start(u64::from(e_lfanew)))
        .map_err(|err| format!("failed to seek PE header: {err}"))?;
    let mut signature = [0u8; 4];
    file.read_exact(&mut signature)
        .map_err(|err| format!("failed to read PE signature: {err}"))?;
    if &signature != b"PE\0\0" {
        return Err("invalid PE signature".to_string());
    }

    file.seek(SeekFrom::Current(20))
        .map_err(|err| format!("failed to seek optional header: {err}"))?;
    let mut magic = [0u8; 2];
    file.read_exact(&mut magic)
        .map_err(|err| format!("failed to read optional header magic: {err}"))?;
    let magic = u16::from_le_bytes(magic);

    match magic {
        0x10b => Ok(false),
        0x20b => Ok(true),
        _ => Err(format!("unknown PE optional header magic: {magic:#x}")),
    }
}

fn write_icon_sidecar_png(output_path: &Path, data_url: &str) -> Result<String, String> {
    let png_bytes = decode_png_data_url(data_url)?;
    let icon_path = output_path.with_extension("png");

    if let Some(parent) = icon_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("failed to create icon sidecar directory: {err}"))?;
    }

    fs::write(&icon_path, png_bytes)
        .map_err(|err| format!("failed to write icon sidecar PNG: {err}"))?;

    Ok(icon_path.to_string_lossy().into_owned())
}

fn decode_png_data_url(data_url: &str) -> Result<Vec<u8>, String> {
    let trimmed = data_url.trim();
    let payload = trimmed
        .strip_prefix("data:image/png;base64,")
        .ok_or_else(|| {
            "unsupported icon data URL (expected data:image/png;base64,...)".to_string()
        })?;

    general_purpose::STANDARD
        .decode(payload)
        .map_err(|err| format!("failed to decode icon PNG data URL: {err}"))
}

pub fn winetricks_available() -> Result<WinetricksAvailableOutput, String> {
    log_backend_event(
        "INFO",
        "GO-CR-301",
        "winetricks_catalog_requested",
        serde_json::json!({}),
    );
    let fallback = fallback_winetricks_components();
    let Some(binary) = find_executable_in_path("winetricks") else {
        let out = WinetricksAvailableOutput {
            source: "fallback".to_string(),
            components: fallback,
        };
        log_backend_event(
            "WARN",
            "GO-CR-302",
            "winetricks_not_found_using_fallback_catalog",
            serde_json::json!({ "components_count": out.components.len() }),
        );
        return Ok(out);
    };

    let mut components = BTreeSet::new();
    for args in &[["dlls", "list"], ["fonts", "list"]] {
        let output = Command::new(&binary)
            .args(args)
            .output()
            .map_err(|err| format!("failed to execute winetricks: {err}"))?;

        if !output.status.success() {
            continue;
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        for component in parse_winetricks_components(&stdout) {
            components.insert(component);
        }
    }

    let parsed = components.into_iter().collect::<Vec<String>>();
    if parsed.is_empty() {
        let out = WinetricksAvailableOutput {
            source: "fallback".to_string(),
            components: fallback,
        };
        log_backend_event(
            "WARN",
            "GO-CR-303",
            "winetricks_catalog_parse_empty_using_fallback",
            serde_json::json!({ "binary": binary, "components_count": out.components.len() }),
        );
        return Ok(out);
    }

    let out = WinetricksAvailableOutput {
        source: "winetricks".to_string(),
        components: parsed,
    };
    log_backend_event(
        "INFO",
        "GO-CR-304",
        "winetricks_catalog_loaded",
        serde_json::json!({ "binary": binary, "components_count": out.components.len() }),
    );
    Ok(out)
}

pub fn import_registry_file(
    input: ImportRegistryFileInput,
) -> Result<ImportRegistryFileOutput, String> {
    log_backend_event(
        "INFO",
        "GO-CR-401",
        "import_registry_file_requested",
        serde_json::json!({ "path": input.path }),
    );
    let bytes = fs::read(&input.path).map_err(|err| format!("failed to read .reg file: {err}"))?;
    let raw = decode_reg_file_text(&bytes)?;
    let (entries, warnings) = parse_reg_file_entries(&raw);

    if entries.is_empty() {
        return Err("no importable registry entries found in .reg file".to_string());
    }

    let out = ImportRegistryFileOutput { entries, warnings };
    log_backend_event(
        "INFO",
        "GO-CR-402",
        "import_registry_file_completed",
        serde_json::json!({
            "path": input.path,
            "entries_count": out.entries.len(),
            "warnings_count": out.warnings.len(),
        }),
    );
    Ok(out)
}

pub fn list_child_directories(
    input: ListChildDirectoriesInput,
) -> Result<ListChildDirectoriesOutput, String> {
    log_backend_event(
        "INFO",
        "GO-CR-501",
        "list_child_directories_requested",
        serde_json::json!({ "path": input.path }),
    );
    let root = PathBuf::from(&input.path);
    let entries = fs::read_dir(&root).map_err(|err| format!("failed to list directory: {err}"))?;

    let mut directories = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|err| format!("failed to read directory entry: {err}"))?;
        let path = entry.path();
        if path.is_dir() {
            directories.push(path.to_string_lossy().into_owned());
        }
    }

    directories.sort_by_key(|value| value.to_ascii_lowercase());

    let out = ListChildDirectoriesOutput {
        path: input.path,
        directories,
    };
    log_backend_event(
        "INFO",
        "GO-CR-502",
        "list_child_directories_completed",
        serde_json::json!({
            "path": out.path,
            "directories_count": out.directories.len(),
        }),
    );
    Ok(out)
}

fn resolve_base_orchestrator_binary(
    requested: &str,
    extra_hints: &[PathBuf],
) -> Result<PathBuf, String> {
    let mut candidates = Vec::<PathBuf>::new();
    let mut seen = BTreeSet::<String>::new();

    let mut push_candidate = |path: PathBuf| {
        let key = path.to_string_lossy().into_owned();
        if seen.insert(key) {
            candidates.push(path);
        }
    };

    if let Ok(path) = env::var("GAME_ORCH_BASE_ORCHESTRATOR") {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            push_candidate(PathBuf::from(trimmed));
        }
    }

    let requested_trimmed = requested.trim();
    if !requested_trimmed.is_empty() {
        push_candidate(PathBuf::from(requested_trimmed));
        if let Ok(cwd) = env::current_dir() {
            push_candidate(cwd.join(requested_trimmed));
        }
    }

    for hint in extra_hints {
        if !hint.as_os_str().is_empty() {
            push_candidate(hint.clone());
        }
    }

    let common_relative_candidates = [
        "target/debug/orchestrator",
        "target/release/orchestrator",
        "apps/creator-tauri/src-tauri/resources/orchestrator-base/orchestrator",
        "src-tauri/resources/orchestrator-base/orchestrator",
        "resources/orchestrator-base/orchestrator",
        "orchestrator-base/orchestrator",
    ];

    if let Ok(cwd) = env::current_dir() {
        for ancestor in cwd.ancestors() {
            for rel in common_relative_candidates {
                push_candidate(ancestor.join(rel));
            }
        }
    }

    if let Ok(exe) = env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            for ancestor in exe_dir.ancestors() {
                for rel in common_relative_candidates {
                    push_candidate(ancestor.join(rel));
                }
            }
        }
    }

    let attempted = candidates
        .iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect::<Vec<_>>();

    log_backend_event(
        "INFO",
        "GO-CR-011",
        "resolving_base_orchestrator_binary",
        serde_json::json!({
            "requested": requested_trimmed,
            "extra_hints_count": extra_hints.len(),
            "attempted_candidates": attempted,
        }),
    );

    if let Some(found) = candidates.into_iter().find(|path| path.is_file()) {
        return Ok(found);
    }

    Err(format!(
        "base orchestrator binary not found. Tried {} candidate(s). Build the 'orchestrator' binary (debug/release) or package it as a Tauri resource.",
        attempted.len()
    ))
}

fn log_backend_event(level: &str, event_code: &str, message: &str, context: serde_json::Value) {
    let ts_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let payload = serde_json::json!({
        "ts_ms": ts_ms,
        "level": level,
        "component": "creator-tauri-backend",
        "event_code": event_code,
        "message": message,
        "pid": std::process::id(),
        "context": context,
    });
    eprintln!("{}", payload);
}

fn collect_missing_files(config: &GameConfig, game_root: &Path) -> Result<Vec<String>, String> {
    let mut missing = Vec::new();

    let exe_path = resolve_relative_path(game_root, &config.relative_exe_path)?;
    if !exe_path.exists() {
        missing.push(config.relative_exe_path.clone());
    }

    for file in &config.integrity_files {
        let path = resolve_relative_path(game_root, file)?;
        if !path.exists() {
            missing.push(file.clone());
        }
    }

    Ok(missing)
}

fn resolve_relative_path(base: &Path, relative: &str) -> Result<PathBuf, String> {
    let normalized = normalize_relative_payload_path(relative)?;
    Ok(base.join(normalized))
}

fn normalize_relative_payload_path(raw: &str) -> Result<PathBuf, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("path is empty".to_string());
    }

    let normalized = trimmed.replace('\\', "/");
    if normalized.starts_with('/') || has_windows_drive_prefix(&normalized) {
        return Err(format!("absolute path is not allowed: {raw}"));
    }

    let mut out = PathBuf::new();
    for part in normalized.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }

        if part == ".." {
            return Err(format!("path traversal is not allowed: {raw}"));
        }

        out.push(part);
    }

    if out.as_os_str().is_empty() {
        return Err(format!("path resolves to empty value: {raw}"));
    }

    Ok(out)
}

fn has_windows_drive_prefix(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic()
}

fn parse_winetricks_components(raw: &str) -> Vec<String> {
    raw.lines()
        .filter_map(|line| {
            let entry = line.split_whitespace().next()?;
            if entry.starts_with('#') || entry.contains(':') {
                return None;
            }

            if entry
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.'))
            {
                Some(entry.to_string())
            } else {
                None
            }
        })
        .collect()
}

fn find_executable_in_path(name: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    for directory in std::env::split_paths(&path_var) {
        let candidate = directory.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn fallback_winetricks_components() -> Vec<String> {
    [
        "corefonts",
        "d3dx9",
        "d3dcompiler_47",
        "dotnet48",
        "dxvk",
        "faudio",
        "galliumnine",
        "mf",
        "msxml3",
        "physx",
        "vcrun2005",
        "vcrun2008",
        "vcrun2010",
        "vcrun2013",
        "vcrun2019",
        "xact",
        "xinput",
    ]
    .iter()
    .map(|item| item.to_string())
    .collect()
}

fn decode_reg_file_text(bytes: &[u8]) -> Result<String, String> {
    if bytes.starts_with(&[0xFF, 0xFE]) {
        let mut units = Vec::new();
        let mut iter = bytes[2..].chunks_exact(2);
        for chunk in &mut iter {
            units.push(u16::from_le_bytes([chunk[0], chunk[1]]));
        }
        return String::from_utf16(&units)
            .map_err(|err| format!("invalid UTF-16LE .reg file: {err}"));
    }

    if bytes.starts_with(&[0xFE, 0xFF]) {
        return Err("UTF-16BE .reg files are not supported".to_string());
    }

    let text = String::from_utf8(bytes.to_vec())
        .map_err(|err| format!("invalid UTF-8 .reg file: {err}"))?;
    Ok(text.strip_prefix('\u{feff}').unwrap_or(&text).to_string())
}

fn parse_reg_file_entries(raw: &str) -> (Vec<RegistryKey>, Vec<String>) {
    let mut entries = Vec::new();
    let mut warnings = Vec::new();
    let mut current_path: Option<String> = None;

    for line in fold_reg_continuations(raw).lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with(';') || trimmed.starts_with('#') {
            continue;
        }

        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            current_path = Some(trimmed[1..trimmed.len() - 1].trim().to_string());
            continue;
        }

        if trimmed.eq_ignore_ascii_case("windows registry editor version 5.00")
            || trimmed.eq_ignore_ascii_case("regedit4")
        {
            continue;
        }

        let Some(path) = current_path.clone() else {
            warnings.push(format!(
                "ignored line outside registry key section: {trimmed}"
            ));
            continue;
        };

        let Some((name_raw, value_raw)) = trimmed.split_once('=') else {
            warnings.push(format!("ignored unparsable registry line: {trimmed}"));
            continue;
        };

        let name = match parse_reg_value_name(name_raw.trim()) {
            Some(name) => name,
            None => {
                warnings.push(format!(
                    "ignored registry value with unsupported name syntax: {trimmed}"
                ));
                continue;
            }
        };

        let value_token = value_raw.trim();
        if value_token == "-" {
            warnings.push(format!(
                "ignored deletion entry (unsupported in key list model): {}={}",
                name_raw.trim(),
                value_token
            ));
            continue;
        }

        let (value_type, value, value_warnings) = parse_reg_data(value_token);
        for warning in value_warnings {
            warnings.push(format!("{path} | {name}: {warning}"));
        }
        entries.push(RegistryKey {
            path,
            name,
            value_type,
            value,
        });
    }

    (entries, warnings)
}

fn fold_reg_continuations(raw: &str) -> String {
    let normalized = raw.replace("\r\n", "\n").replace('\r', "\n");
    let mut out = Vec::new();
    let mut acc = String::new();

    for line in normalized.lines() {
        let trimmed_end = line.trim_end();
        if acc.is_empty() {
            acc.push_str(trimmed_end);
        } else {
            acc.push_str(trimmed_end.trim_start());
        }

        if acc.ends_with('\\') {
            acc.pop();
            continue;
        }

        out.push(std::mem::take(&mut acc));
    }

    if !acc.is_empty() {
        out.push(acc);
    }

    out.join("\n")
}

fn parse_reg_value_name(raw: &str) -> Option<String> {
    if raw == "@" {
        return Some("@".to_string());
    }
    if raw.starts_with('"') && raw.ends_with('"') && raw.len() >= 2 {
        return Some(unescape_reg_string(&raw[1..raw.len() - 1]));
    }
    None
}

fn parse_reg_data(raw: &str) -> (String, String, Vec<String>) {
    let lower = raw.to_ascii_lowercase();
    let mut warnings = Vec::new();

    if raw.starts_with('"') && raw.ends_with('"') && raw.len() >= 2 {
        return (
            "REG_SZ".to_string(),
            unescape_reg_string(&raw[1..raw.len() - 1]),
            warnings,
        );
    }

    if let Some(value) = strip_prefix_ascii_case(raw, "dword:") {
        return (
            "REG_DWORD".to_string(),
            value.trim().to_ascii_lowercase(),
            warnings,
        );
    }

    if lower.starts_with("hex(b):") {
        let payload = &raw[7..];
        let value = match normalize_registry_hex_payload(payload) {
            Ok(value) => value,
            Err(err) => {
                warnings.push(format!("kept raw REG_QWORD hex payload ({err})"));
                payload.trim().to_string()
            }
        };
        return ("REG_QWORD".to_string(), value, warnings);
    }

    if lower.starts_with("hex(2):") {
        let payload = &raw[7..];
        let value = match normalize_registry_hex_payload(payload) {
            Ok(value) => value,
            Err(err) => {
                warnings.push(format!("kept raw REG_EXPAND_SZ hex payload ({err})"));
                payload.trim().to_string()
            }
        };
        return ("REG_EXPAND_SZ".to_string(), value, warnings);
    }

    if lower.starts_with("hex(7):") {
        let payload = &raw[7..];
        let value = match normalize_registry_hex_payload(payload) {
            Ok(value) => value,
            Err(err) => {
                warnings.push(format!("kept raw REG_MULTI_SZ hex payload ({err})"));
                payload.trim().to_string()
            }
        };
        return ("REG_MULTI_SZ".to_string(), value, warnings);
    }

    if lower.starts_with("hex:") {
        let original = &raw[4..];
        let value = match normalize_registry_hex_payload(original) {
            Ok(value) => value,
            Err(err) => {
                warnings.push(format!("kept raw REG_BINARY hex payload ({err})"));
                original.trim().to_string()
            }
        };
        return ("REG_BINARY".to_string(), value, warnings);
    }

    if lower.starts_with("hex(") {
        let type_end = raw.find("):").unwrap_or(raw.len());
        let suffix = if type_end + 2 <= raw.len() {
            &raw[type_end + 2..]
        } else {
            ""
        };
        let value = match normalize_registry_hex_payload(suffix) {
            Ok(value) => value,
            Err(err) => {
                warnings.push(format!("kept raw typed hex payload ({err})"));
                suffix.trim().to_string()
            }
        };
        return ("REG_BINARY".to_string(), value, warnings);
    }

    ("REG_SZ".to_string(), raw.trim().to_string(), warnings)
}

fn strip_prefix_ascii_case<'a>(raw: &'a str, prefix: &str) -> Option<&'a str> {
    if raw.len() < prefix.len() {
        return None;
    }
    let (head, tail) = raw.split_at(prefix.len());
    if head.eq_ignore_ascii_case(prefix) {
        Some(tail)
    } else {
        None
    }
}

fn normalize_registry_hex_payload(raw: &str) -> Result<String, String> {
    let mut chunks = Vec::new();
    for token in raw.split(',') {
        let cleaned = token
            .chars()
            .filter(|ch| !ch.is_whitespace())
            .collect::<String>();

        if cleaned.is_empty() {
            continue;
        }

        if cleaned.len() != 2 || !cleaned.chars().all(|ch| ch.is_ascii_hexdigit()) {
            return Err(format!("invalid hex byte token '{cleaned}'"));
        }

        chunks.push(cleaned.to_ascii_lowercase());
    }

    Ok(chunks.join(","))
}

fn unescape_reg_string(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut chars = raw.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            if let Some(next) = chars.next() {
                out.push(match next {
                    '\\' => '\\',
                    '"' => '"',
                    'n' => '\n',
                    'r' => '\r',
                    't' => '\t',
                    other => other,
                });
            } else {
                out.push('\\');
            }
        } else {
            out.push(ch);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid_json_input() {
        let input = CreateExecutableInput {
            base_binary_path: "/tmp/base.bin".to_string(),
            output_path: "/tmp/output.bin".to_string(),
            config_json: "{ invalid json }".to_string(),
            backup_existing: true,
            make_executable: true,
            icon_png_data_url: None,
        };

        let err = create_executable(input).expect_err("invalid json must fail");
        assert!(err.contains("invalid config JSON"));
    }

    #[test]
    fn command_wrapper_calls_hash() {
        let input = HashExeInput {
            executable_path: "/does/not/exist.exe".to_string(),
        };
        let err = hash_executable(input).expect_err("missing file must fail");
        assert!(err.contains("io error"));
    }

    #[test]
    fn rejects_invalid_test_config_json() {
        let input = TestConfigurationInput {
            config_json: "{ invalid json }".to_string(),
            game_root: "/tmp".to_string(),
        };

        let err = test_configuration(input).expect_err("invalid json must fail");
        assert!(err.contains("invalid config JSON"));
    }

    #[test]
    fn parses_winetricks_output_lines() {
        let parsed = parse_winetricks_components(
            r#"
            d3dx9                Direct3D 9
            corefonts            Core fonts
            # comment
            "#,
        );

        assert_eq!(parsed, vec!["d3dx9".to_string(), "corefonts".to_string()]);
    }

    #[test]
    fn parses_registry_multiline_hex_value() {
        let raw = r#"
Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Test]
"Multi"=hex(7):41,00,00,00,\
  42,00,00,00,00,00
"#;

        let (entries, warnings) = parse_reg_file_entries(raw);
        assert!(warnings.is_empty(), "unexpected warnings: {warnings:?}");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].path, r"HKEY_CURRENT_USER\Software\Test");
        assert_eq!(entries[0].name, "Multi");
        assert_eq!(entries[0].value_type, "REG_MULTI_SZ");
        assert_eq!(entries[0].value, "41,00,00,00,42,00,00,00,00,00");
    }

    #[test]
    fn parses_case_insensitive_dword_prefix() {
        let raw = r#"
Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Test]
"Flag"=DWORD:00000001
"#;

        let (entries, warnings) = parse_reg_file_entries(raw);
        assert!(warnings.is_empty(), "unexpected warnings: {warnings:?}");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].value_type, "REG_DWORD");
        assert_eq!(entries[0].value, "00000001");
    }

    #[test]
    fn warns_on_invalid_hex_token_but_keeps_entry() {
        let raw = r#"
Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Test]
"Broken"=hex:aa,zz,10
"#;

        let (entries, warnings) = parse_reg_file_entries(raw);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].value_type, "REG_BINARY");
        assert_eq!(entries[0].value, "aa,zz,10");
        assert!(!warnings.is_empty());
    }
}
