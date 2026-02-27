#![allow(dead_code)]

use std::error::Error;
use std::fmt;

pub type DomainResult<T> = Result<T, DomainError>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DomainFlow {
    Play,
    Winecfg,
    Runtime,
}

impl DomainFlow {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Play => "play",
            Self::Winecfg => "winecfg",
            Self::Runtime => "runtime",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlayFlowError {
    InstanceAlreadyRunning,
    MissingGameExecutable,
    IntegrityCheckFailed,
    DoctorBlocked,
    PrefixSetupMandatoryFailure,
    RegistryImportFailed,
    WinecfgOverrideApplyFailed,
    FolderMountSetupFailed,
    PreLaunchScriptFailed,
    GameLaunchFailed,
}

impl PlayFlowError {
    pub const fn code(self) -> &'static str {
        match self {
            Self::InstanceAlreadyRunning => "PLAY_INSTANCE_LOCKED",
            Self::MissingGameExecutable => "PLAY_MISSING_EXECUTABLE",
            Self::IntegrityCheckFailed => "PLAY_INTEGRITY_FAILED",
            Self::DoctorBlocked => "PLAY_DOCTOR_BLOCKED",
            Self::PrefixSetupMandatoryFailure => "PLAY_PREFIX_SETUP_FAILED",
            Self::RegistryImportFailed => "PLAY_REGISTRY_IMPORT_FAILED",
            Self::WinecfgOverrideApplyFailed => "PLAY_WINECFG_APPLY_FAILED",
            Self::FolderMountSetupFailed => "PLAY_FOLDER_MOUNT_FAILED",
            Self::PreLaunchScriptFailed => "PLAY_PRE_SCRIPT_FAILED",
            Self::GameLaunchFailed => "PLAY_LAUNCH_FAILED",
        }
    }

    pub const fn message(self) -> &'static str {
        match self {
            Self::InstanceAlreadyRunning => "another orchestrator instance is already running",
            Self::MissingGameExecutable => "game executable is missing",
            Self::IntegrityCheckFailed => "integrity check failed",
            Self::DoctorBlocked => "doctor returned blocker",
            Self::PrefixSetupMandatoryFailure => "mandatory prefix setup step failed",
            Self::RegistryImportFailed => "registry import failed",
            Self::WinecfgOverrideApplyFailed => "winecfg override apply failed",
            Self::FolderMountSetupFailed => "folder mount setup failed",
            Self::PreLaunchScriptFailed => "pre-launch script failed",
            Self::GameLaunchFailed => "game launch command failed",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WinecfgFlowError {
    DoctorBlocked,
    PrefixSetupMandatoryFailure,
    WinecfgOverrideApplyFailed,
    WinecfgCommandFailed,
}

impl WinecfgFlowError {
    pub const fn code(self) -> &'static str {
        match self {
            Self::DoctorBlocked => "WINECFG_DOCTOR_BLOCKED",
            Self::PrefixSetupMandatoryFailure => "WINECFG_PREFIX_SETUP_FAILED",
            Self::WinecfgOverrideApplyFailed => "WINECFG_APPLY_FAILED",
            Self::WinecfgCommandFailed => "WINECFG_COMMAND_FAILED",
        }
    }

    pub const fn message(self) -> &'static str {
        match self {
            Self::DoctorBlocked => "doctor returned blocker",
            Self::PrefixSetupMandatoryFailure => "mandatory prefix setup step failed",
            Self::WinecfgOverrideApplyFailed => "winecfg override apply failed",
            Self::WinecfgCommandFailed => "winecfg command failed",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeFlowError {
    MissingHomeDirectory,
    OverridePathUnavailable,
    OverridesReadFailed,
    OverridesParseFailed,
    OverridesWriteFailed,
    FeatureNotOverridable,
    RuntimeCandidateUnavailable,
    RuntimePolicyBlocked,
}

impl RuntimeFlowError {
    pub const fn code(self) -> &'static str {
        match self {
            Self::MissingHomeDirectory => "RUNTIME_HOME_MISSING",
            Self::OverridePathUnavailable => "RUNTIME_OVERRIDE_PATH_UNAVAILABLE",
            Self::OverridesReadFailed => "RUNTIME_OVERRIDES_READ_FAILED",
            Self::OverridesParseFailed => "RUNTIME_OVERRIDES_PARSE_FAILED",
            Self::OverridesWriteFailed => "RUNTIME_OVERRIDES_WRITE_FAILED",
            Self::FeatureNotOverridable => "RUNTIME_FEATURE_NOT_OVERRIDABLE",
            Self::RuntimeCandidateUnavailable => "RUNTIME_CANDIDATE_UNAVAILABLE",
            Self::RuntimePolicyBlocked => "RUNTIME_POLICY_BLOCKED",
        }
    }

    pub const fn message(self) -> &'static str {
        match self {
            Self::MissingHomeDirectory => "home directory is not set",
            Self::OverridePathUnavailable => "runtime overrides path is unavailable",
            Self::OverridesReadFailed => "failed to read runtime overrides",
            Self::OverridesParseFailed => "invalid runtime overrides payload",
            Self::OverridesWriteFailed => "failed to write runtime overrides",
            Self::FeatureNotOverridable => "feature is not overridable with current policy",
            Self::RuntimeCandidateUnavailable => "no runtime candidate available",
            Self::RuntimePolicyBlocked => "runtime policy blocked execution",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DomainError {
    Play(PlayFlowError),
    Winecfg(WinecfgFlowError),
    Runtime(RuntimeFlowError),
}

impl DomainError {
    pub const fn flow(self) -> DomainFlow {
        match self {
            Self::Play(_) => DomainFlow::Play,
            Self::Winecfg(_) => DomainFlow::Winecfg,
            Self::Runtime(_) => DomainFlow::Runtime,
        }
    }

    pub const fn code(self) -> &'static str {
        match self {
            Self::Play(err) => err.code(),
            Self::Winecfg(err) => err.code(),
            Self::Runtime(err) => err.code(),
        }
    }

    pub const fn message(self) -> &'static str {
        match self {
            Self::Play(err) => err.message(),
            Self::Winecfg(err) => err.message(),
            Self::Runtime(err) => err.message(),
        }
    }
}

impl fmt::Display for DomainError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{} [{}]: {}",
            self.flow().as_str(),
            self.code(),
            self.message()
        )
    }
}

impl Error for DomainError {}

impl From<PlayFlowError> for DomainError {
    fn from(value: PlayFlowError) -> Self {
        Self::Play(value)
    }
}

impl From<WinecfgFlowError> for DomainError {
    fn from(value: WinecfgFlowError) -> Self {
        Self::Winecfg(value)
    }
}

impl From<RuntimeFlowError> for DomainError {
    fn from(value: RuntimeFlowError) -> Self {
        Self::Runtime(value)
    }
}
