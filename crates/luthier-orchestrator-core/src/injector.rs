use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

use crate::config::GameConfig;
use crate::error::OrchestratorError;
use crate::trailer::{append_asset_bundle, extract_asset_bundle, AssetBundleInput};

#[derive(Debug, Clone, Copy)]
pub struct InjectOptions {
    pub backup_existing: bool,
    pub make_executable: bool,
}

impl Default for InjectOptions {
    fn default() -> Self {
        Self {
            backup_existing: true,
            make_executable: true,
        }
    }
}

#[derive(Debug, Clone)]
pub struct InjectionResult {
    pub output_path: PathBuf,
    pub config_len: usize,
    pub config_sha256_hex: String,
}

#[derive(Debug, Clone, Copy)]
pub struct InjectPayloadParts<'a> {
    pub base_bytes: &'a [u8],
    pub config_json: &'a [u8],
    pub hero_image: Option<&'a [u8]>,
    pub icon_png: Option<&'a [u8]>,
}

pub fn inject_from_files(
    base_binary_path: &Path,
    config_json_path: &Path,
    output_path: &Path,
    options: InjectOptions,
) -> Result<InjectionResult, OrchestratorError> {
    let base_bytes = fs::read(base_binary_path)?;
    let config_bytes = fs::read(config_json_path)?;

    inject_from_parts(
        InjectPayloadParts {
            base_bytes: &base_bytes,
            config_json: &config_bytes,
            hero_image: None,
            icon_png: None,
        },
        output_path,
        options,
    )
}

pub fn inject_from_parts(
    parts: InjectPayloadParts<'_>,
    output_path: &Path,
    options: InjectOptions,
) -> Result<InjectionResult, OrchestratorError> {
    let _: GameConfig = serde_json::from_slice(parts.config_json)?;

    let injected = append_asset_bundle(
        parts.base_bytes,
        AssetBundleInput {
            config_json: parts.config_json,
            hero_image: parts.hero_image,
            icon_png: parts.icon_png,
        },
    );

    if options.backup_existing && output_path.exists() {
        let backup_path = backup_path_for(output_path);
        fs::copy(output_path, backup_path)?;
    }

    write_atomic(output_path, &injected)?;

    if options.make_executable {
        set_executable_bit(output_path)?;
    }

    let extracted = extract_assets_from_file(output_path)?;
    if extracted.config_json != parts.config_json
        || extracted.hero_image.as_deref() != parts.hero_image
        || extracted.icon_png.as_deref() != parts.icon_png
    {
        return Err(OrchestratorError::VerificationFailed);
    }

    Ok(InjectionResult {
        output_path: output_path.to_path_buf(),
        config_len: parts.config_json.len(),
        config_sha256_hex: sha256_hex(parts.config_json),
    })
}

pub fn extract_config_from_file(path: &Path) -> Result<Vec<u8>, OrchestratorError> {
    Ok(extract_assets_from_file(path)?.config_json)
}

pub fn extract_assets_from_file(
    path: &Path,
) -> Result<crate::trailer::PayloadAssets, OrchestratorError> {
    let bin = fs::read(path)?;
    extract_asset_bundle(&bin)
}

fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), OrchestratorError> {
    let parent = path
        .parent()
        .ok_or(OrchestratorError::MissingOutputParent)?;
    fs::create_dir_all(parent)?;

    let file_name = path
        .file_name()
        .map(|f| f.to_string_lossy().into_owned())
        .unwrap_or_else(|| "luthier-orchestrator".to_string());

    let tmp_name = format!(".{file_name}.tmp-{}", std::process::id());
    let tmp_path = parent.join(tmp_name);

    fs::write(&tmp_path, bytes)?;
    fs::rename(&tmp_path, path)?;

    Ok(())
}

fn backup_path_for(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .map(|name| {
            let mut value = OsString::from(name);
            value.push(".bak");
            value
        })
        .unwrap_or_else(|| OsString::from("luthier-orchestrator.bak"));

    path.with_file_name(file_name)
}

#[cfg(unix)]
fn set_executable_bit(path: &Path) -> Result<(), OrchestratorError> {
    use std::os::unix::fs::PermissionsExt;

    let mut permissions = fs::metadata(path)?.permissions();
    let mode = permissions.mode() | 0o111;
    permissions.set_mode(mode);
    fs::set_permissions(path, permissions)?;

    Ok(())
}

#[cfg(not(unix))]
fn set_executable_bit(_path: &Path) -> Result<(), OrchestratorError> {
    Ok(())
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest: [u8; 32] = hasher.finalize().into();
    to_lower_hex(&digest)
}

fn to_lower_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(HEX[(b >> 4) as usize] as char);
        out.push(HEX[(b & 0x0f) as usize] as char);
    }
    out
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::*;
    use crate::config::*;

    #[test]
    fn injects_and_extracts_roundtrip() {
        let root = make_temp_dir("inject-roundtrip");

        let base_path = root.join("base.bin");
        let cfg_path = root.join("config.json");
        let out_path = root.join("luthier-orchestrator");

        fs::write(&base_path, b"BASE-BINARY").expect("write base");

        let cfg = sample_config();
        let cfg_bytes = serde_json::to_vec(&cfg).expect("serialize config");
        fs::write(&cfg_path, &cfg_bytes).expect("write config");

        let result = inject_from_files(&base_path, &cfg_path, &out_path, InjectOptions::default())
            .expect("inject config");

        assert_eq!(result.output_path, out_path);
        assert_eq!(result.config_len, cfg_bytes.len());
        assert_eq!(
            extract_config_from_file(&out_path).expect("extract"),
            cfg_bytes
        );

        fs::remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn extracts_individual_assets() {
        let root = make_temp_dir("extract-assets");
        let out_path = root.join("luthier-orchestrator");

        let cfg_bytes = serde_json::to_vec(&sample_config()).expect("serialize config");
        inject_from_parts(
            InjectPayloadParts {
                base_bytes: b"BASE",
                config_json: &cfg_bytes,
                hero_image: Some(b"hero"),
                icon_png: Some(b"icon"),
            },
            &out_path,
            InjectOptions::default(),
        )
        .expect("inject");

        let extracted = extract_assets_from_file(&out_path).expect("extract assets");
        assert_eq!(extracted.config_json, cfg_bytes);
        assert_eq!(extracted.hero_image.as_deref(), Some(b"hero".as_slice()));
        assert_eq!(extracted.icon_png.as_deref(), Some(b"icon".as_slice()));

        fs::remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn creates_backup_when_output_exists() {
        let root = make_temp_dir("inject-backup");

        let base_path = root.join("base.bin");
        let cfg_path = root.join("config.json");
        let out_path = root.join("luthier-orchestrator");
        let backup_path = out_path.with_file_name("luthier-orchestrator.bak");

        fs::write(&base_path, b"BASE-BINARY").expect("write base");
        fs::write(&out_path, b"OLD-BINARY").expect("write existing output");

        let cfg = sample_config();
        let cfg_bytes = serde_json::to_vec(&cfg).expect("serialize config");
        fs::write(&cfg_path, &cfg_bytes).expect("write config");

        inject_from_files(&base_path, &cfg_path, &out_path, InjectOptions::default())
            .expect("inject config");

        let backup = fs::read(&backup_path).expect("read backup");
        assert_eq!(backup, b"OLD-BINARY");

        fs::remove_dir_all(root).expect("cleanup");
    }

    fn make_temp_dir(prefix: &str) -> PathBuf {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_millis();
        let root =
            std::env::temp_dir().join(format!("go-{prefix}-{}-{}", std::process::id(), millis));
        fs::create_dir_all(&root).expect("create temp dir");
        root
    }

    fn sample_config() -> GameConfig {
        serde_json::from_value(serde_json::json!({
            "config_version": 1,
            "created_by": "test",
            "game_name": "Sample",
            "exe_hash": "abc123",
            "relative_exe_path": "./game.exe",
            "launch_args": [],
            "runner": {
                "proton_version": "GE-Proton9-10",
                "auto_update": true,
                "esync": true,
                "fsync": true,
                "runtime_preference": "Auto"
            },
            "environment": {
                "gamemode": "OptionalOn",
                "gamescope": {"state":"OptionalOff","resolution":null,"fsr":false},
                "mangohud": "OptionalOff",
                "prime_offload": "OptionalOff",
                "custom_vars": {}
            },
            "compatibility": {
                "wine_wayland": "OptionalOff",
                "hdr": "OptionalOff",
                "auto_dxvk_nvapi": "OptionalOff",
                "easy_anti_cheat_runtime": "OptionalOff",
                "battleye_runtime": "OptionalOff",
                "staging": "OptionalOff",
                "wrapper_commands": []
            },
            "winecfg": {
                "windows_version": null,
                "dll_overrides": [],
                "auto_capture_mouse": {"state":"OptionalOff","use_wine_default":false},
                "window_decorations": {"state":"OptionalOff","use_wine_default":false},
                "window_manager_control": {"state":"OptionalOff","use_wine_default":false},
                "virtual_desktop": {"state":{"state":"OptionalOff","use_wine_default":false},"resolution":null},
                "screen_dpi": null,
                "desktop_integration": {"state":"OptionalOff","use_wine_default":false},
                "mime_associations": {"state":"OptionalOff","use_wine_default":false},
                "desktop_folders": [],
                "drives": [],
                "audio_driver": null
            },
            "dependencies": [],
            "extra_system_dependencies": [],
            "requirements": {
                "runtime": {"strict": false, "primary": "ProtonUmu", "fallback_order": ["ProtonUmu","Wine"]},
                "umu": "OptionalOn",
                "winetricks": "OptionalOff",
                "gamescope": "OptionalOff",
                "gamemode": "OptionalOn",
                "mangohud": "OptionalOff",
                "steam_runtime": "OptionalOff"
            },
            "registry_keys": [],
            "integrity_files": [],
            "folder_mounts": [],
            "splash": {"hero_image_url":"","hero_image_data_url":""},
            "scripts": {"pre_launch":"","post_launch":""}
        }))
        .expect("valid sample config")
    }
}
