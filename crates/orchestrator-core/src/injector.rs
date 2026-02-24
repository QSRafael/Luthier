use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

use crate::config::GameConfig;
use crate::error::OrchestratorError;
use crate::trailer::{append_config, extract_config_json};

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

pub fn inject_from_files(
    base_binary_path: &Path,
    config_json_path: &Path,
    output_path: &Path,
    options: InjectOptions,
) -> Result<InjectionResult, OrchestratorError> {
    let base_bytes = fs::read(base_binary_path)?;
    let config_bytes = fs::read(config_json_path)?;

    inject_from_parts(&base_bytes, &config_bytes, output_path, options)
}

pub fn inject_from_parts(
    base_bytes: &[u8],
    config_bytes: &[u8],
    output_path: &Path,
    options: InjectOptions,
) -> Result<InjectionResult, OrchestratorError> {
    // Validate schema before embedding.
    let _: GameConfig = serde_json::from_slice(config_bytes)?;

    let injected = append_config(base_bytes, config_bytes);

    if options.backup_existing && output_path.exists() {
        let backup_path = backup_path_for(output_path);
        fs::copy(output_path, backup_path)?;
    }

    write_atomic(output_path, &injected)?;

    if options.make_executable {
        set_executable_bit(output_path)?;
    }

    // Verify immediately so the creator can fail early with actionable error.
    let extracted = extract_config_from_file(output_path)?;
    if extracted != config_bytes {
        return Err(OrchestratorError::VerificationFailed);
    }

    Ok(InjectionResult {
        output_path: output_path.to_path_buf(),
        config_len: config_bytes.len(),
        config_sha256_hex: sha256_hex(config_bytes),
    })
}

pub fn extract_config_from_file(path: &Path) -> Result<Vec<u8>, OrchestratorError> {
    let bin = fs::read(path)?;
    let cfg = extract_config_json(&bin)?;
    Ok(cfg.to_vec())
}

fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), OrchestratorError> {
    let parent = path
        .parent()
        .ok_or(OrchestratorError::MissingOutputParent)?;
    fs::create_dir_all(parent)?;

    let file_name = path
        .file_name()
        .map(|f| f.to_string_lossy().into_owned())
        .unwrap_or_else(|| "orchestrator".to_string());

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
        .unwrap_or_else(|| OsString::from("orchestrator.bak"));

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
    use std::collections::HashMap;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::*;
    use crate::config::*;

    #[test]
    fn injects_and_extracts_roundtrip() {
        let root = make_temp_dir("inject-roundtrip");

        let base_path = root.join("base.bin");
        let cfg_path = root.join("config.json");
        let out_path = root.join("orchestrator");

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
    fn creates_backup_when_output_exists() {
        let root = make_temp_dir("inject-backup");

        let base_path = root.join("base.bin");
        let cfg_path = root.join("config.json");
        let out_path = root.join("orchestrator");
        let backup_path = out_path.with_file_name("orchestrator.bak");

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
        GameConfig {
            config_version: 1,
            created_by: "test".to_string(),
            game_name: "Sample Game".to_string(),
            exe_hash: "a1b2c3".to_string(),
            relative_exe_path: "./game.exe".to_string(),
            launch_args: vec!["-windowed".to_string()],
            runner: RunnerConfig {
                proton_version: "GE-Proton9-10".to_string(),
                auto_update: true,
                esync: true,
                fsync: true,
                runtime_preference: RuntimePreference::Auto,
            },
            environment: EnvConfig {
                gamemode: FeatureState::OptionalOn,
                gamescope: GamescopeConfig {
                    state: FeatureState::OptionalOff,
                    resolution: Some("1920x1080".to_string()),
                    fsr: false,
                },
                mangohud: FeatureState::OptionalOff,
                prime_offload: false,
                custom_vars: HashMap::new(),
            },
            compatibility: CompatibilityConfig {
                wine_wayland: FeatureState::OptionalOff,
                hdr: FeatureState::OptionalOff,
                auto_dxvk_nvapi: FeatureState::OptionalOff,
                easy_anti_cheat_runtime: FeatureState::OptionalOff,
                battleye_runtime: FeatureState::OptionalOff,
                staging: FeatureState::OptionalOff,
                wrapper_commands: Vec::new(),
            },
            winecfg: WinecfgConfig {
                dll_overrides: Vec::new(),
                auto_capture_mouse: FeatureState::OptionalOn,
                window_decorations: FeatureState::OptionalOn,
                window_manager_control: FeatureState::OptionalOn,
                virtual_desktop: VirtualDesktopConfig {
                    state: FeatureState::OptionalOff,
                    resolution: None,
                },
                desktop_integration: FeatureState::OptionalOn,
                drives: Vec::new(),
                audio_driver: None,
            },
            dependencies: Vec::new(),
            extra_system_dependencies: Vec::new(),
            requirements: RequirementsConfig {
                runtime: RuntimePolicy {
                    strict: false,
                    primary: RuntimeCandidate::ProtonNative,
                    fallback_order: vec![RuntimeCandidate::Wine],
                },
                umu: FeatureState::OptionalOn,
                winetricks: FeatureState::OptionalOff,
                gamescope: FeatureState::OptionalOff,
                gamemode: FeatureState::OptionalOn,
                mangohud: FeatureState::OptionalOff,
                steam_runtime: FeatureState::OptionalOff,
            },
            registry_keys: Vec::new(),
            integrity_files: vec!["./data/core.dll".to_string()],
            folder_mounts: Vec::new(),
            scripts: ScriptsConfig {
                pre_launch: String::new(),
                post_launch: String::new(),
            },
        }
    }
}
