use std::sync::OnceLock;

static SPLASH_LOCALE: OnceLock<SplashLocale> = OnceLock::new();

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SplashLocale {
    PtBr,
    EnUs,
}

#[derive(Debug, Clone, Copy)]
pub(crate) enum SplashTextKey {
    WindowTitle,
    WindowDependencies,
    StatusPreparingExecution,
    StatusPreparingEnvironment,
    StatusCreatingPrefix,
    StatusPreparingPrefixDependencies,
    StatusPrefixAlreadyConfigured,
    StatusRegistryApplied,
    StatusRegistryAlreadyConfigured,
    StatusWinecfgApplied,
    StatusWinecfgAlreadyApplied,
    StatusMountingFolders,
    StatusRunningPreparation,
    StatusLaunchingGame,
    StatusLaunchFailed,
    StatusGameClosed,
    ActionContinue,
    ActionExit,
    ActionBack,
    ActionSave,
    ScreenGame,
    ScreenConfig,
    ConfigSubtitle,
    ConfigNone,
    ToggleDefault,
    ToggleEnabled,
    ToggleDisabled,
    MissingDepsTitle,
    MissingDepsHint,
    DepOk,
    DepNotOk,
    CountdownContinuing,
    CountdownContinuingNow,
    PromptWorked,
    PromptShare,
    AnswerYes,
    AnswerNo,
    FeedbackPlaceholder,
    SpawnFailed,
}

pub(crate) fn initialize_splash_locale(lang_override: Option<&str>) {
    let _ = SPLASH_LOCALE.set(resolve_splash_locale(lang_override));
}

fn active_splash_locale() -> SplashLocale {
    *SPLASH_LOCALE.get_or_init(|| resolve_splash_locale(None))
}

fn resolve_splash_locale(lang_override: Option<&str>) -> SplashLocale {
    let candidate = lang_override
        .and_then(non_empty_trimmed)
        .map(str::to_string)
        .or_else(|| std::env::var("LC_ALL").ok())
        .or_else(|| std::env::var("LC_MESSAGES").ok())
        .or_else(|| std::env::var("LANG").ok())
        .unwrap_or_else(|| "en-US".to_string());
    let normalized = candidate.replace('_', "-").to_ascii_lowercase();
    if normalized.starts_with("pt") {
        SplashLocale::PtBr
    } else {
        SplashLocale::EnUs
    }
}

pub(crate) fn t(key: SplashTextKey) -> &'static str {
    t_for(active_splash_locale(), key)
}

fn t_for(locale: SplashLocale, key: SplashTextKey) -> &'static str {
    match locale {
        SplashLocale::PtBr => match key {
            SplashTextKey::WindowTitle => "Luthier",
            SplashTextKey::WindowDependencies => "Dependencias",
            SplashTextKey::StatusPreparingExecution => "Preparando execucao",
            SplashTextKey::StatusPreparingEnvironment => "Preparando ambiente",
            SplashTextKey::StatusCreatingPrefix => "Criando o wineprefix",
            SplashTextKey::StatusPreparingPrefixDependencies => {
                "Preparando dependencias do prefixo"
            }
            SplashTextKey::StatusPrefixAlreadyConfigured => "Prefixo ja configurado",
            SplashTextKey::StatusRegistryApplied => "Aplicando configuracoes de registro",
            SplashTextKey::StatusRegistryAlreadyConfigured => "Registro ja configurado",
            SplashTextKey::StatusWinecfgApplied => "Aplicando configuracoes do Wine",
            SplashTextKey::StatusWinecfgAlreadyApplied => "Configuracoes do Wine ja aplicadas",
            SplashTextKey::StatusMountingFolders => "Montando pastas",
            SplashTextKey::StatusRunningPreparation => "Executando preparacao",
            SplashTextKey::StatusLaunchingGame => "Iniciando jogo...",
            SplashTextKey::StatusLaunchFailed => "Falha ao iniciar o jogo",
            SplashTextKey::StatusGameClosed => "Jogo encerrado",
            SplashTextKey::ActionContinue => "Continuar",
            SplashTextKey::ActionExit => "Sair",
            SplashTextKey::ActionBack => "Voltar",
            SplashTextKey::ActionSave => "Salvar",
            SplashTextKey::ScreenGame => "Jogo",
            SplashTextKey::ScreenConfig => "Configuracao",
            SplashTextKey::ConfigSubtitle => "Opcoes opcionais desta execucao",
            SplashTextKey::ConfigNone => "Nenhuma opcao configuravel",
            SplashTextKey::ToggleDefault => "Padrao",
            SplashTextKey::ToggleEnabled => "Ativado",
            SplashTextKey::ToggleDisabled => "Desativado",
            SplashTextKey::MissingDepsTitle => "Dependencias faltando",
            SplashTextKey::MissingDepsHint => {
                "Instale as dependencias faltantes antes de continuar"
            }
            SplashTextKey::DepOk => "ok",
            SplashTextKey::DepNotOk => "nao ok",
            SplashTextKey::CountdownContinuing => "Continuando em {n}...",
            SplashTextKey::CountdownContinuingNow => "Continuando...",
            SplashTextKey::PromptWorked => "Funcionou como deveria?",
            SplashTextKey::PromptShare => {
                "Deseja compartilhar payload e executavel com a comunidade?"
            }
            SplashTextKey::AnswerYes => "Sim",
            SplashTextKey::AnswerNo => "Nao",
            SplashTextKey::FeedbackPlaceholder => {
                "Essa etapa ainda nao envia nada. Placeholder do fluxo final."
            }
            SplashTextKey::SpawnFailed => "Falha ao iniciar",
        },
        SplashLocale::EnUs => match key {
            SplashTextKey::WindowTitle => "Luthier",
            SplashTextKey::WindowDependencies => "Dependencies",
            SplashTextKey::StatusPreparingExecution => "Preparing execution",
            SplashTextKey::StatusPreparingEnvironment => "Preparing environment",
            SplashTextKey::StatusCreatingPrefix => "Creating Wine prefix",
            SplashTextKey::StatusPreparingPrefixDependencies => "Preparing prefix dependencies",
            SplashTextKey::StatusPrefixAlreadyConfigured => "Prefix already configured",
            SplashTextKey::StatusRegistryApplied => "Applying registry configuration",
            SplashTextKey::StatusRegistryAlreadyConfigured => "Registry already configured",
            SplashTextKey::StatusWinecfgApplied => "Applying Wine configuration",
            SplashTextKey::StatusWinecfgAlreadyApplied => "Wine configuration already applied",
            SplashTextKey::StatusMountingFolders => "Mounting folders",
            SplashTextKey::StatusRunningPreparation => "Running pre-launch preparation",
            SplashTextKey::StatusLaunchingGame => "Starting game...",
            SplashTextKey::StatusLaunchFailed => "Failed to start the game",
            SplashTextKey::StatusGameClosed => "Game closed",
            SplashTextKey::ActionContinue => "Continue",
            SplashTextKey::ActionExit => "Exit",
            SplashTextKey::ActionBack => "Back",
            SplashTextKey::ActionSave => "Save",
            SplashTextKey::ScreenGame => "Game",
            SplashTextKey::ScreenConfig => "Configuration",
            SplashTextKey::ConfigSubtitle => "Optional settings for this run",
            SplashTextKey::ConfigNone => "No configurable options",
            SplashTextKey::ToggleDefault => "Default",
            SplashTextKey::ToggleEnabled => "Enabled",
            SplashTextKey::ToggleDisabled => "Disabled",
            SplashTextKey::MissingDepsTitle => "Missing dependencies",
            SplashTextKey::MissingDepsHint => "Install missing dependencies before continuing",
            SplashTextKey::DepOk => "ok",
            SplashTextKey::DepNotOk => "not ok",
            SplashTextKey::CountdownContinuing => "Continuing in {n}...",
            SplashTextKey::CountdownContinuingNow => "Continuing...",
            SplashTextKey::PromptWorked => "Did it work as expected?",
            SplashTextKey::PromptShare => "Share payload and executable with the community?",
            SplashTextKey::AnswerYes => "Yes",
            SplashTextKey::AnswerNo => "No",
            SplashTextKey::FeedbackPlaceholder => {
                "This step does not send anything yet. Placeholder for the final flow."
            }
            SplashTextKey::SpawnFailed => "Launch failed",
        },
    }
}

pub(crate) fn t_installing_winetricks(verbs: &str) -> String {
    match active_splash_locale() {
        SplashLocale::PtBr => {
            if verbs.trim().is_empty() {
                "Instalando winetricks".to_string()
            } else {
                format!("Instalando winetricks: {verbs}")
            }
        }
        SplashLocale::EnUs => {
            if verbs.trim().is_empty() {
                "Installing winetricks".to_string()
            } else {
                format!("Installing winetricks: {verbs}")
            }
        }
    }
}

pub(crate) fn t_process_exit(code: Option<i32>) -> String {
    match active_splash_locale() {
        SplashLocale::PtBr => format!(
            "Processo encerrado com codigo {}",
            code.map(|v| v.to_string())
                .unwrap_or_else(|| "desconhecido".to_string())
        ),
        SplashLocale::EnUs => format!(
            "Process exited with code {}",
            code.map(|v| v.to_string())
                .unwrap_or_else(|| "unknown".to_string())
        ),
    }
}

fn non_empty_trimmed(raw: &str) -> Option<&str> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}
