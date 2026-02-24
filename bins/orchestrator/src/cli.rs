use clap::{Parser, ValueEnum};

#[derive(Debug, Parser)]
#[command(name = "orchestrator")]
#[command(about = "Game Orchestrator CLI")]
pub struct Cli {
    #[arg(long)]
    pub play: bool,

    #[arg(long)]
    pub config: bool,

    #[arg(long)]
    pub doctor: bool,

    #[arg(long)]
    pub winecfg: bool,

    #[arg(long)]
    pub verbose: bool,

    #[arg(long)]
    pub show_config: bool,

    #[arg(long)]
    pub lang: Option<String>,

    #[arg(long, value_enum)]
    pub set_mangohud: Option<OptionalToggle>,

    #[arg(long, value_enum)]
    pub set_gamescope: Option<OptionalToggle>,

    #[arg(long, value_enum)]
    pub set_gamemode: Option<OptionalToggle>,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum OptionalToggle {
    On,
    Off,
    Default,
}
