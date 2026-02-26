use std::collections::BTreeSet;
use std::env;
use std::fs;
use std::io::{Cursor, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::{engine::general_purpose, Engine as _};
use creator_core::{
    create_orchestrator_binary, sha256_file, validate_game_config, CreateOrchestratorRequest,
};
use image::{imageops::FilterType, DynamicImage, GenericImageView, ImageFormat};
use orchestrator_core::{
    doctor::run_doctor, prefix::build_prefix_setup_plan, GameConfig, RegistryKey,
};
use pelite::pe32::Pe as _;
use pelite::pe64::Pe as _;
use pelite::{pe32, pe64};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};

const HERO_SPLASH_TARGET_WIDTH: u32 = 960;
const HERO_SPLASH_TARGET_HEIGHT: u32 = 310;
const HERO_SEARCH_ENDPOINT: &str = "https://steamgrid.usebottles.com/api/search/";
const STEAMGRIDDB_API_BASE: &str = "https://www.steamgriddb.com/api/v2";
const STEAMGRIDDB_PUBLIC_API_BASE: &str = "https://www.steamgriddb.com/api/public";

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
pub struct SearchHeroImageInput {
    pub game_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchHeroImageOutput {
    pub source: String,
    pub image_url: String,
    #[serde(default)]
    pub game_id: Option<u64>,
    #[serde(default)]
    pub candidate_image_urls: Vec<String>,
}

#[derive(Debug, Clone)]
struct HeroSearchResult {
    source: String,
    image_url: String,
    game_id: Option<u64>,
    candidate_image_urls: Vec<String>,
}

#[derive(Debug, Clone)]
struct PublicHeroSearchGame {
    game_id: u64,
    hero_urls: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PrepareHeroImageInput {
    pub image_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PrepareHeroImageOutput {
    pub source_url: String,
    pub data_url: String,
    pub width: u32,
    pub height: u32,
    pub original_width: u32,
    pub original_height: u32,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ListDirectoryEntriesInput {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ListDirectoryEntriesOutput {
    pub path: String,
    pub directories: Vec<String>,
    pub files: Vec<String>,
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
        let validation_issues = err.validation_issues().map(|issues| {
            issues
                .iter()
                .map(|issue| {
                    serde_json::json!({
                        "code": issue.code,
                        "field": issue.field,
                        "message": issue.message,
                    })
                })
                .collect::<Vec<serde_json::Value>>()
        });
        log_backend_event(
            "ERROR",
            "GO-CR-090",
            "create_executable_failed",
            serde_json::json!({
                "error": message,
                "base_binary_path": request.base_binary_path,
                "output_path": request.output_path,
                "validation_issues": validation_issues,
            }),
        );
        message
    })?;

    let icon_sidecar_path = None;

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

pub fn search_hero_image(input: SearchHeroImageInput) -> Result<SearchHeroImageOutput, String> {
    let game_name = input.game_name.trim();
    if game_name.is_empty() {
        return Err("game name is empty".to_string());
    }

    log_backend_event(
        "INFO",
        "GO-CR-121",
        "search_hero_image_requested",
        serde_json::json!({ "game_name": game_name }),
    );

    let encoded_title = urlencoding::encode(game_name);
    let url = format!("{HERO_SEARCH_ENDPOINT}{encoded_title}");
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build()
        .map_err(|err| format!("failed to build HTTP client: {err}"))?;

    if let Some(result) = search_hero_image_via_steamgriddb_public(game_name, &client)? {
        log_backend_event(
            "INFO",
            "GO-CR-122",
            "search_hero_image_completed",
            serde_json::json!({
                "game_name": game_name,
                "image_url": result.image_url,
                "source": result.source,
                "game_id": result.game_id,
                "candidate_count": result.candidate_image_urls.len(),
            }),
        );
        return Ok(SearchHeroImageOutput {
            source: result.source,
            image_url: result.image_url,
            game_id: result.game_id,
            candidate_image_urls: result.candidate_image_urls,
        });
    }

    if let Some(result) = search_hero_image_via_steamgriddb_api(game_name, &client)? {
        log_backend_event(
            "INFO",
            "GO-CR-122",
            "search_hero_image_completed",
            serde_json::json!({
                "game_name": game_name,
                "image_url": result.image_url,
                "source": result.source,
                "game_id": result.game_id,
                "candidate_count": result.candidate_image_urls.len(),
            }),
        );
        return Ok(SearchHeroImageOutput {
            source: result.source,
            image_url: result.image_url,
            game_id: result.game_id,
            candidate_image_urls: result.candidate_image_urls,
        });
    }

    let response = client
        .get(&url)
        .header(
            reqwest::header::USER_AGENT,
            "game-orchestrator-creator/0.1 hero-search",
        )
        .send()
        .map_err(|err| format!("failed to query hero image search endpoint: {err}"))?;

    let status = response.status();
    let body = response
        .text()
        .map_err(|err| format!("failed to read hero search response: {err}"))?;

    if !status.is_success() {
        return Err(format!("hero image search failed with HTTP {status}"));
    }

    let image_url = parse_hero_search_response_url(&body)
        .ok_or_else(|| "hero image search returned an unsupported response".to_string())?;

    if !is_hero_image_url(&image_url) {
        return Err(
            "automatic search returned a grid image, not a hero image; configure STEAMGRIDDB_API_KEY (or GAME_ORCH_STEAMGRIDDB_API_KEY) to fetch SteamGridDB hero images".to_string(),
        );
    }

    log_backend_event(
        "INFO",
        "GO-CR-122",
        "search_hero_image_completed",
        serde_json::json!({
            "game_name": game_name,
            "image_url": image_url,
        }),
    );

    Ok(SearchHeroImageOutput {
        source: "steamgrid-usebottles-hero".to_string(),
        image_url: image_url.clone(),
        game_id: None,
        candidate_image_urls: vec![image_url],
    })
}

pub fn prepare_hero_image(input: PrepareHeroImageInput) -> Result<PrepareHeroImageOutput, String> {
    let image_url = input.image_url.trim();
    if image_url.is_empty() {
        return Err("hero image URL is empty".to_string());
    }

    log_backend_event(
        "INFO",
        "GO-CR-123",
        "prepare_hero_image_requested",
        serde_json::json!({ "image_url": image_url }),
    );

    let source_bytes = fetch_remote_bytes(image_url)?;
    let decoded = image::load_from_memory(&source_bytes)
        .map_err(|err| format!("failed to decode hero image: {err}"))?;
    let (original_width, original_height) = decoded.dimensions();
    let processed = crop_to_ratio_and_resize(
        decoded,
        96,
        31,
        HERO_SPLASH_TARGET_WIDTH,
        HERO_SPLASH_TARGET_HEIGHT,
    )?;

    let (width, height) = processed.dimensions();
    let mut out_bytes = Vec::new();
    let mut cursor = Cursor::new(&mut out_bytes);
    processed
        .write_to(&mut cursor, ImageFormat::WebP)
        .map_err(|err| format!("failed to encode hero image as WebP: {err}"))?;

    let data_url = format!(
        "data:image/webp;base64,{}",
        general_purpose::STANDARD.encode(&out_bytes)
    );

    log_backend_event(
        "INFO",
        "GO-CR-124",
        "prepare_hero_image_completed",
        serde_json::json!({
            "image_url": image_url,
            "original_width": original_width,
            "original_height": original_height,
            "width": width,
            "height": height,
            "webp_size_bytes": out_bytes.len(),
        }),
    );

    Ok(PrepareHeroImageOutput {
        source_url: image_url.to_string(),
        data_url,
        width,
        height,
        original_width,
        original_height,
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

    validate_game_config(&config).map_err(|err| {
        log_backend_event(
            "ERROR",
            "GO-CR-291",
            "test_configuration_payload_validation_failed",
            serde_json::json!({
                "error": err.to_string(),
                "validation_issues": err.validation_issues().map(|issues| {
                    issues.iter().map(|issue| {
                        serde_json::json!({
                            "code": issue.code,
                            "field": issue.field,
                            "message": issue.message,
                        })
                    }).collect::<Vec<serde_json::Value>>()
                }),
            }),
        );
        err.to_string()
    })?;

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

fn parse_hero_search_response_url(body: &str) -> Option<String> {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Ok(url) = serde_json::from_str::<String>(trimmed) {
        return validate_hero_http_url(&url).map(str::to_string);
    }

    validate_hero_http_url(trimmed).map(str::to_string)
}

fn search_hero_image_via_steamgriddb_api(
    game_name: &str,
    client: &Client,
) -> Result<Option<HeroSearchResult>, String> {
    let Some(api_key) = read_steamgriddb_api_key() else {
        return Ok(None);
    };

    let encoded_title = urlencoding::encode(game_name);
    let search_url = format!("{STEAMGRIDDB_API_BASE}/search/autocomplete/{encoded_title}");
    let search_response = client
        .get(&search_url)
        .header(reqwest::header::AUTHORIZATION, format!("Bearer {api_key}"))
        .header(
            reqwest::header::USER_AGENT,
            "game-orchestrator-creator/0.1 steamgriddb-hero-search",
        )
        .send()
        .map_err(|err| format!("failed to query SteamGridDB autocomplete: {err}"))?;

    let search_status = search_response.status();
    let search_json: serde_json::Value = search_response
        .json()
        .map_err(|err| format!("failed to decode SteamGridDB autocomplete response: {err}"))?;
    if !search_status.is_success() {
        return Err(format!(
            "SteamGridDB autocomplete failed with HTTP {search_status}"
        ));
    }

    let game_id = search_json
        .get("data")
        .and_then(|data| data.as_array())
        .and_then(|items| items.first())
        .and_then(|item| item.get("id"))
        .and_then(|id| id.as_u64())
        .ok_or_else(|| "SteamGridDB autocomplete returned no matching game".to_string())?;

    let heroes_url = format!("{STEAMGRIDDB_API_BASE}/heroes/game/{game_id}");
    let heroes_response = client
        .get(&heroes_url)
        .header(reqwest::header::AUTHORIZATION, format!("Bearer {api_key}"))
        .header(
            reqwest::header::USER_AGENT,
            "game-orchestrator-creator/0.1 steamgriddb-hero-search",
        )
        .send()
        .map_err(|err| format!("failed to query SteamGridDB heroes: {err}"))?;

    let heroes_status = heroes_response.status();
    let heroes_json: serde_json::Value = heroes_response
        .json()
        .map_err(|err| format!("failed to decode SteamGridDB heroes response: {err}"))?;
    if !heroes_status.is_success() {
        return Err(format!(
            "SteamGridDB heroes lookup failed with HTTP {heroes_status}"
        ));
    }

    let hero_urls = collect_steamgriddb_hero_urls(
        heroes_json
            .get("data")
            .and_then(|data| data.as_array())
            .into_iter()
            .flatten(),
    );
    let hero_url = hero_urls
        .first()
        .cloned()
        .ok_or_else(|| "SteamGridDB heroes lookup returned no hero image".to_string())?;

    Ok(Some(HeroSearchResult {
        source: "steamgriddb-api-hero".to_string(),
        image_url: hero_url,
        game_id: Some(game_id),
        candidate_image_urls: hero_urls,
    }))
}

fn search_hero_image_via_steamgriddb_public(
    game_name: &str,
    client: &Client,
) -> Result<Option<HeroSearchResult>, String> {
    let autocomplete_game_id = search_steamgriddb_public_autocomplete_game_id(game_name, client)?;
    let header_hero_url = if let Some(game_id) = autocomplete_game_id {
        fetch_steamgriddb_public_game_header_hero(game_id, client)?
    } else {
        None
    };

    let search_games = match search_steamgriddb_public_hero_games(game_name, client) {
        Ok(games) => games,
        Err(_) if header_hero_url.is_some() => Vec::new(),
        Err(err) => return Err(err),
    };
    let matched_game = if let Some(game_id) = autocomplete_game_id {
        search_games
            .iter()
            .find(|game| game.game_id == game_id)
            .cloned()
    } else {
        None
    };
    let selected_search_game = matched_game.or_else(|| search_games.first().cloned());

    let selected_game_id =
        autocomplete_game_id.or_else(|| selected_search_game.as_ref().map(|g| g.game_id));
    let mut candidate_urls = Vec::new();
    if let Some(url) = header_hero_url.clone() {
        candidate_urls.push(url);
    }
    if let Some(game) = selected_search_game {
        candidate_urls.extend(game.hero_urls);
    }
    let candidate_urls = dedupe_urls_preserve_order(candidate_urls);

    let image_url = header_hero_url
        .or_else(|| candidate_urls.first().cloned())
        .ok_or_else(|| "SteamGridDB public hero search returned no hero image".to_string())?;

    Ok(Some(HeroSearchResult {
        source: "steamgriddb-public-hero".to_string(),
        image_url,
        game_id: selected_game_id,
        candidate_image_urls: candidate_urls,
    }))
}

fn search_steamgriddb_public_hero_games(
    game_name: &str,
    client: &Client,
) -> Result<Vec<PublicHeroSearchGame>, String> {
    let search_url = format!("{STEAMGRIDDB_PUBLIC_API_BASE}/search/main/games");
    let search_response = client
        .post(&search_url)
        .header(reqwest::header::ACCEPT, "application/json, text/plain, */*")
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .header(reqwest::header::ORIGIN, "https://www.steamgriddb.com")
        .header(
            reqwest::header::REFERER,
            "https://www.steamgriddb.com/search/heroes",
        )
        .header(
            reqwest::header::USER_AGENT,
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        )
        .json(&serde_json::json!({
            "asset_type": "hero",
            "term": game_name,
            "offset": 0,
            "filters": {
                "styles": ["all"],
                "dimensions": ["all"],
                "type": ["all"],
                "order": "score_desc"
            }
        }))
        .send()
        .map_err(|err| format!("failed to query SteamGridDB public hero search: {err}"))?;

    let search_status = search_response.status();
    let search_json: serde_json::Value = search_response.json().map_err(|err| {
        format!("failed to decode SteamGridDB public hero search response: {err}")
    })?;
    if !search_status.is_success() {
        return Err(format!(
            "SteamGridDB public hero search failed with HTTP {search_status}"
        ));
    }
    if search_json
        .get("success")
        .and_then(|v| v.as_bool())
        .is_some_and(|ok| !ok)
    {
        return Err("SteamGridDB public hero search returned success=false".to_string());
    }

    let Some(games) = search_json
        .get("data")
        .and_then(|v| v.get("games"))
        .and_then(|v| v.as_array())
    else {
        return Ok(Vec::new());
    };

    let mut out = Vec::new();
    for game in games {
        let Some(game_id) = game
            .get("game")
            .and_then(|v| v.get("id"))
            .and_then(|v| v.as_u64())
        else {
            continue;
        };
        let hero_urls = collect_steamgriddb_hero_urls(
            game.get("assets")
                .and_then(|v| v.as_array())
                .into_iter()
                .flatten(),
        );
        if hero_urls.is_empty() {
            continue;
        }
        out.push(PublicHeroSearchGame { game_id, hero_urls });
    }

    Ok(out)
}

fn search_steamgriddb_public_autocomplete_game_id(
    game_name: &str,
    client: &Client,
) -> Result<Option<u64>, String> {
    let search_url = format!("{STEAMGRIDDB_PUBLIC_API_BASE}/search/autocomplete");
    let response = client
        .get(&search_url)
        .header(reqwest::header::ACCEPT, "application/json, text/plain, */*")
        .header(reqwest::header::REFERER, "https://www.steamgriddb.com/")
        .header(
            reqwest::header::USER_AGENT,
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        )
        .query(&[("term", game_name)])
        .send()
        .map_err(|err| format!("failed to query SteamGridDB public autocomplete: {err}"))?;

    let status = response.status();
    let json: serde_json::Value = response.json().map_err(|err| {
        format!("failed to decode SteamGridDB public autocomplete response: {err}")
    })?;

    if !status.is_success() {
        return Err(format!(
            "SteamGridDB public autocomplete failed with HTTP {status}"
        ));
    }
    if json
        .get("success")
        .and_then(|v| v.as_bool())
        .is_some_and(|ok| !ok)
    {
        return Err("SteamGridDB public autocomplete returned success=false".to_string());
    }

    let games = json
        .get("data")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "SteamGridDB public autocomplete returned no data list".to_string())?;

    let game_id = games
        .first()
        .and_then(|game| game.get("id"))
        .and_then(|v| v.as_u64());

    Ok(game_id)
}

fn fetch_steamgriddb_public_game_header_hero(
    game_id: u64,
    client: &Client,
) -> Result<Option<String>, String> {
    let game_url = format!("{STEAMGRIDDB_PUBLIC_API_BASE}/game/{game_id}");
    let game_response = client
        .get(&game_url)
        .header(reqwest::header::ACCEPT, "application/json, text/plain, */*")
        .header(
            reqwest::header::REFERER,
            format!("https://www.steamgriddb.com/game/{game_id}/heroes"),
        )
        .header(
            reqwest::header::USER_AGENT,
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        )
        .send()
        .map_err(|err| format!("failed to query SteamGridDB public game endpoint: {err}"))?;

    let game_status = game_response.status();
    let game_json: serde_json::Value = game_response
        .json()
        .map_err(|err| format!("failed to decode SteamGridDB public game response: {err}"))?;

    if !game_status.is_success() {
        return Ok(None);
    }
    if !game_json
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Ok(None);
    }

    Ok(game_json
        .get("data")
        .and_then(|v| v.get("header"))
        .and_then(|v| v.get("asset"))
        .and_then(extract_steamgriddb_hero_url))
}

fn read_steamgriddb_api_key() -> Option<String> {
    for key in ["STEAMGRIDDB_API_KEY", "GAME_ORCH_STEAMGRIDDB_API_KEY"] {
        if let Ok(value) = env::var(key) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

fn collect_steamgriddb_hero_urls<'a>(
    items: impl IntoIterator<Item = &'a serde_json::Value>,
) -> Vec<String> {
    dedupe_urls_preserve_order(items.into_iter().filter_map(extract_steamgriddb_hero_url))
}

fn dedupe_urls_preserve_order(urls: impl IntoIterator<Item = String>) -> Vec<String> {
    let mut seen = BTreeSet::new();
    let mut out = Vec::new();
    for url in urls {
        if seen.insert(url.clone()) {
            out.push(url);
        }
    }
    out
}

fn extract_steamgriddb_hero_url(item: &serde_json::Value) -> Option<String> {
    for candidate in [
        item.get("thumb"),
        item.get("url"),
        item.get("thumbnail"),
        item.get("image"),
    ] {
        if let Some(value) = candidate {
            if let Some(url) = value.as_str() {
                if validate_hero_http_url(url).is_some() && is_hero_image_url(url) {
                    return Some(url.to_string());
                }
            }
            if let Some(obj) = value.as_object() {
                for key in ["url", "thumb", "small", "medium", "large"] {
                    if let Some(url) = obj.get(key).and_then(|v| v.as_str()) {
                        if validate_hero_http_url(url).is_some() && is_hero_image_url(url) {
                            return Some(url.to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

fn validate_hero_http_url(raw: &str) -> Option<&str> {
    let trimmed = raw.trim();
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        Some(trimmed)
    } else {
        None
    }
}

fn is_hero_image_url(raw: &str) -> bool {
    let lower = raw.to_ascii_lowercase();
    lower.contains("/hero/")
        || lower.contains("/hero_thumb/")
        || lower.contains("/file/sgdb-cdn/hero/")
        || lower.contains("/file/sgdb-cdn/hero_thumb/")
}

fn fetch_remote_bytes(url: &str) -> Result<Vec<u8>, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|err| format!("failed to build HTTP client: {err}"))?;

    let response = client
        .get(url)
        .header(
            reqwest::header::USER_AGENT,
            "game-orchestrator-creator/0.1 hero-image-fetch",
        )
        .send()
        .map_err(|err| format!("failed to download hero image: {err}"))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("failed to download hero image (HTTP {status})"));
    }

    response
        .bytes()
        .map(|b| b.to_vec())
        .map_err(|err| format!("failed to read hero image bytes: {err}"))
}

fn crop_to_ratio_and_resize(
    image: DynamicImage,
    ratio_w: u32,
    ratio_h: u32,
    target_w: u32,
    target_h: u32,
) -> Result<DynamicImage, String> {
    let (src_w, src_h) = image.dimensions();
    if src_w == 0 || src_h == 0 {
        return Err("hero image has invalid dimensions".to_string());
    }

    let lhs = u64::from(src_w) * u64::from(ratio_h);
    let rhs = u64::from(src_h) * u64::from(ratio_w);

    let (crop_x, crop_y, crop_w, crop_h) = if lhs > rhs {
        let crop_w = ((u64::from(src_h) * u64::from(ratio_w)) / u64::from(ratio_h))
            .clamp(1, u64::from(src_w)) as u32;
        let crop_x = (src_w.saturating_sub(crop_w)) / 2;
        (crop_x, 0, crop_w, src_h)
    } else {
        let crop_h = ((u64::from(src_w) * u64::from(ratio_h)) / u64::from(ratio_w))
            .clamp(1, u64::from(src_h)) as u32;
        let crop_y = (src_h.saturating_sub(crop_h)) / 2;
        (0, crop_y, src_w, crop_h)
    };

    let cropped = image.crop_imm(crop_x, crop_y, crop_w, crop_h);
    Ok(cropped.resize_exact(target_w, target_h, FilterType::Lanczos3))
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

pub fn list_directory_entries(
    input: ListDirectoryEntriesInput,
) -> Result<ListDirectoryEntriesOutput, String> {
    log_backend_event(
        "INFO",
        "GO-CR-503",
        "list_directory_entries_requested",
        serde_json::json!({ "path": input.path }),
    );
    let root = PathBuf::from(&input.path);
    let entries = fs::read_dir(&root).map_err(|err| format!("failed to list directory: {err}"))?;

    let mut directories = Vec::new();
    let mut files = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|err| format!("failed to read directory entry: {err}"))?;
        let path = entry.path();
        if path.is_dir() {
            directories.push(path.to_string_lossy().into_owned());
        } else if path.is_file() {
            files.push(path.to_string_lossy().into_owned());
        }
    }

    directories.sort_by_key(|value| value.to_ascii_lowercase());
    files.sort_by_key(|value| value.to_ascii_lowercase());

    let out = ListDirectoryEntriesOutput {
        path: input.path,
        directories,
        files,
    };
    log_backend_event(
        "INFO",
        "GO-CR-504",
        "list_directory_entries_completed",
        serde_json::json!({
            "path": out.path,
            "directories_count": out.directories.len(),
            "files_count": out.files.len(),
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
