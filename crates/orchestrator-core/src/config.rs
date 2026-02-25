use std::collections::HashMap;

use serde::{Deserialize, Deserializer, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameConfig {
    pub config_version: u32,
    pub created_by: String,
    pub game_name: String,
    pub exe_hash: String,
    pub relative_exe_path: String,
    pub launch_args: Vec<String>,
    pub runner: RunnerConfig,
    pub environment: EnvConfig,
    pub compatibility: CompatibilityConfig,
    pub winecfg: WinecfgConfig,
    pub dependencies: Vec<String>,
    pub extra_system_dependencies: Vec<SystemDependency>,
    pub requirements: RequirementsConfig,
    pub registry_keys: Vec<RegistryKey>,
    pub integrity_files: Vec<String>,
    pub folder_mounts: Vec<FolderMount>,
    pub scripts: ScriptsConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RunnerConfig {
    pub proton_version: String,
    pub auto_update: bool,
    pub esync: bool,
    pub fsync: bool,
    pub runtime_preference: RuntimePreference,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnvConfig {
    pub gamemode: FeatureState,
    pub gamescope: GamescopeConfig,
    pub mangohud: FeatureState,
    #[serde(deserialize_with = "deserialize_feature_state_from_bool_or_enum")]
    pub prime_offload: FeatureState,
    pub custom_vars: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompatibilityConfig {
    pub wine_wayland: FeatureState,
    pub hdr: FeatureState,
    pub auto_dxvk_nvapi: FeatureState,
    pub easy_anti_cheat_runtime: FeatureState,
    pub battleye_runtime: FeatureState,
    pub staging: FeatureState,
    pub wrapper_commands: Vec<WrapperCommand>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WinecfgConfig {
    #[serde(default)]
    pub windows_version: Option<String>,
    pub dll_overrides: Vec<DllOverrideRule>,
    pub auto_capture_mouse: WinecfgFeaturePolicy,
    pub window_decorations: WinecfgFeaturePolicy,
    pub window_manager_control: WinecfgFeaturePolicy,
    pub virtual_desktop: VirtualDesktopConfig,
    #[serde(default)]
    pub screen_dpi: Option<u16>,
    pub desktop_integration: WinecfgFeaturePolicy,
    #[serde(default = "default_winecfg_feature_policy_optional_off")]
    pub mime_associations: WinecfgFeaturePolicy,
    #[serde(default)]
    pub desktop_folders: Vec<WineDesktopFolderMapping>,
    pub drives: Vec<WineDriveMapping>,
    pub audio_driver: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub schema_version: u32,
    pub preferred_locale: String,
    pub telemetry_opt_in: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum FeatureState {
    MandatoryOn,
    MandatoryOff,
    OptionalOn,
    OptionalOff,
}

impl FeatureState {
    pub fn is_enabled(self) -> bool {
        matches!(self, Self::MandatoryOn | Self::OptionalOn)
    }

    pub fn is_mandatory(self) -> bool {
        matches!(self, Self::MandatoryOn | Self::MandatoryOff)
    }
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
pub struct WinecfgFeaturePolicy {
    pub state: FeatureState,
    pub use_wine_default: bool,
}

impl WinecfgFeaturePolicy {
    pub fn is_enabled(self) -> bool {
        self.state.is_enabled()
    }
}

impl Default for WinecfgFeaturePolicy {
    fn default() -> Self {
        Self {
            state: FeatureState::OptionalOff,
            use_wine_default: false,
        }
    }
}

impl<'de> Deserialize<'de> for WinecfgFeaturePolicy {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum Compat {
            Legacy(FeatureState),
            Structured {
                state: FeatureState,
                #[serde(default)]
                use_wine_default: bool,
            },
        }

        match Compat::deserialize(deserializer)? {
            Compat::Legacy(state) => Ok(Self {
                state,
                use_wine_default: false,
            }),
            Compat::Structured {
                state,
                use_wine_default,
            } => Ok(Self {
                state,
                use_wine_default,
            }),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum RuntimePreference {
    Auto,
    Proton,
    Wine,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeCandidate {
    ProtonUmu,
    ProtonNative,
    Wine,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RequirementsConfig {
    pub runtime: RuntimePolicy,
    pub umu: FeatureState,
    pub winetricks: FeatureState,
    pub gamescope: FeatureState,
    pub gamemode: FeatureState,
    pub mangohud: FeatureState,
    pub steam_runtime: FeatureState,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RuntimePolicy {
    pub strict: bool,
    pub primary: RuntimeCandidate,
    pub fallback_order: Vec<RuntimeCandidate>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GamescopeConfig {
    pub state: FeatureState,
    pub resolution: Option<String>,
    pub fsr: bool,
    #[serde(default)]
    pub game_width: String,
    #[serde(default)]
    pub game_height: String,
    #[serde(default)]
    pub output_width: String,
    #[serde(default)]
    pub output_height: String,
    #[serde(default = "default_gamescope_upscale_method")]
    pub upscale_method: String,
    #[serde(default = "default_gamescope_window_type")]
    pub window_type: String,
    #[serde(default)]
    pub enable_limiter: bool,
    #[serde(default)]
    pub fps_limiter: String,
    #[serde(default)]
    pub fps_limiter_no_focus: String,
    #[serde(default)]
    pub force_grab_cursor: bool,
    #[serde(default)]
    pub additional_options: String,
}

fn default_gamescope_upscale_method() -> String {
    "fsr".to_string()
}

fn default_gamescope_window_type() -> String {
    "fullscreen".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WrapperCommand {
    pub state: FeatureState,
    pub executable: String,
    pub args: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DllOverrideRule {
    pub dll: String,
    pub mode: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VirtualDesktopConfig {
    pub state: WinecfgFeaturePolicy,
    pub resolution: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WineDriveMapping {
    pub letter: String,
    pub source_relative_path: String,
    pub state: FeatureState,
    #[serde(default)]
    pub host_path: Option<String>,
    #[serde(default)]
    pub drive_type: Option<String>,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub serial: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WineDesktopFolderMapping {
    pub folder_key: String,
    pub shortcut_name: String,
    pub linux_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RegistryKey {
    pub path: String,
    pub name: String,
    pub value_type: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScriptsConfig {
    pub pre_launch: String,
    pub post_launch: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FolderMount {
    pub source_relative_path: String,
    pub target_windows_path: String,
    pub create_source_if_missing: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemDependency {
    pub name: String,
    pub state: FeatureState,
    pub check_commands: Vec<String>,
    pub check_env_vars: Vec<String>,
    pub check_paths: Vec<String>,
}

fn deserialize_feature_state_from_bool_or_enum<'de, D>(
    deserializer: D,
) -> Result<FeatureState, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Compat {
        Bool(bool),
        State(FeatureState),
    }

    match Compat::deserialize(deserializer)? {
        Compat::Bool(true) => Ok(FeatureState::OptionalOn),
        Compat::Bool(false) => Ok(FeatureState::OptionalOff),
        Compat::State(state) => Ok(state),
    }
}

fn default_winecfg_feature_policy_optional_off() -> WinecfgFeaturePolicy {
    WinecfgFeaturePolicy {
        state: FeatureState::OptionalOff,
        use_wine_default: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn feature_state_roundtrip() {
        let state = FeatureState::OptionalOn;
        let raw = serde_json::to_string(&state).expect("serialize");
        let parsed: FeatureState = serde_json::from_str(&raw).expect("deserialize");
        assert_eq!(parsed, state);
    }
}
