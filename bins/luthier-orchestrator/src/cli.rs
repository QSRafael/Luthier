use clap::{Parser, ValueEnum};

#[derive(Debug, Parser)]
#[command(name = "luthier-orchestrator")]
#[command(about = "Luthier Orchestrator CLI")]
#[command(
    after_help = "Examples:\n  game --doctor\n  game --doctor --verbose\n  game --doctor --play\n  game --play\n  game --play-splash\n  game --set-mangohud on --set-gamescope off\n  game --set-mangohud off --play\n  game --show-payload\n  game --show-base64-hero-image\n  game --save-payload"
)]
pub struct Cli {
    #[arg(long, help = "Run game launch pipeline without splash")]
    pub play: bool,

    #[arg(long = "play-splash", help = "Run game launch pipeline with splash")]
    pub play_splash: bool,

    #[arg(long, help = "Run doctor checks and print categorized result")]
    pub doctor: bool,

    #[arg(long, help = "Run Wine configuration flow")]
    pub winecfg: bool,

    #[arg(long, help = "Alias for full doctor output (already default)")]
    pub verbose: bool,

    #[arg(
        long = "show-payload",
        help = "Print embedded payload (hero base64 hidden by default)"
    )]
    pub show_payload: bool,

    #[arg(
        long = "show-base64-hero-image",
        help = "Print embedded payload including splash hero base64 image"
    )]
    pub show_hero_image_base64: bool,

    #[arg(
        long = "save-payload",
        help = "Save embedded payload JSON to luthier-payload.json in game root"
    )]
    pub save_payload: bool,

    #[arg(
        long,
        help = "Locale override for splash/UI text (example: pt-BR, en-US)"
    )]
    pub lang: Option<String>,

    #[arg(long, value_enum, help = "Override MangoHud optional state")]
    pub set_mangohud: Option<OptionalToggle>,

    #[arg(long, value_enum, help = "Override Gamescope optional state")]
    pub set_gamescope: Option<OptionalToggle>,

    #[arg(long, value_enum, help = "Override GameMode optional state")]
    pub set_gamemode: Option<OptionalToggle>,

    #[arg(long, value_enum, help = "Override UMU optional state")]
    pub set_umu: Option<OptionalToggle>,

    #[arg(long, value_enum, help = "Override Winetricks optional state")]
    pub set_winetricks: Option<OptionalToggle>,

    #[arg(long, value_enum, help = "Override Steam Runtime optional state")]
    pub set_steam_runtime: Option<OptionalToggle>,

    #[arg(long, value_enum, help = "Override Prime Offload optional state")]
    pub set_prime_offload: Option<OptionalToggle>,

    #[arg(long, value_enum, help = "Override Wine-Wayland optional state")]
    pub set_wine_wayland: Option<OptionalToggle>,

    #[arg(long, value_enum, help = "Override HDR optional state")]
    pub set_hdr: Option<OptionalToggle>,

    #[arg(long, value_enum, help = "Override DXVK-NVAPI optional state")]
    pub set_auto_dxvk_nvapi: Option<OptionalToggle>,

    #[arg(
        long,
        value_enum,
        help = "Override Easy Anti-Cheat runtime optional state"
    )]
    pub set_easy_anti_cheat_runtime: Option<OptionalToggle>,

    #[arg(long, value_enum, help = "Override BattlEye runtime optional state")]
    pub set_battleye_runtime: Option<OptionalToggle>,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum OptionalToggle {
    On,
    Off,
    Default,
}
