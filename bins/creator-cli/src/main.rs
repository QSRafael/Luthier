use std::fs;
use std::path::PathBuf;

use anyhow::Context;
use clap::{Parser, Subcommand};
use creator_core::{
    create_orchestrator_binary, sha256_file, validate_game_config_relative_paths,
    CreateOrchestratorRequest,
};
use orchestrator_core::{doctor::run_doctor, prefix::build_prefix_setup_plan, GameConfig};

#[derive(Debug, Parser)]
#[command(name = "creator-cli")]
#[command(about = "CLI utilities for Game Orchestrator Creator")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    Hash {
        #[arg(long)]
        exe: PathBuf,
    },
    Test {
        #[arg(long)]
        config: PathBuf,
        #[arg(long)]
        game_root: PathBuf,
    },
    Create {
        #[arg(long)]
        base: PathBuf,
        #[arg(long)]
        config: PathBuf,
        #[arg(long)]
        output: PathBuf,
    },
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Command::Hash { exe } => run_hash(exe),
        Command::Test { config, game_root } => run_test(config, game_root),
        Command::Create {
            base,
            config,
            output,
        } => run_create(base, config, output),
    }
}

fn run_hash(exe: PathBuf) -> anyhow::Result<()> {
    let hash = sha256_file(&exe).with_context(|| format!("failed to hash {}", exe.display()))?;
    println!("{hash}");
    Ok(())
}

fn run_test(config_path: PathBuf, game_root: PathBuf) -> anyhow::Result<()> {
    let config: GameConfig = load_config(&config_path)?;
    validate_game_config_relative_paths(&config)?;

    let missing_files = collect_missing_files(&config, &game_root);
    let doctor = run_doctor(Some(&config));
    let prefix_plan = build_prefix_setup_plan(&config)?;

    let status = if missing_files.is_empty()
        && !matches!(
            doctor.summary,
            orchestrator_core::doctor::CheckStatus::BLOCKER
        ) {
        "OK"
    } else {
        "BLOCKER"
    };

    let output = serde_json::json!({
        "status": status,
        "missing_files": missing_files,
        "doctor": doctor,
        "prefix_setup_plan": prefix_plan,
    });

    println!("{}", serde_json::to_string_pretty(&output)?);
    Ok(())
}

fn run_create(base: PathBuf, config_path: PathBuf, output: PathBuf) -> anyhow::Result<()> {
    let config: GameConfig = load_config(&config_path)?;

    let result = create_orchestrator_binary(&CreateOrchestratorRequest {
        base_binary_path: base,
        output_path: output,
        config,
        backup_existing: true,
        make_executable: true,
    })?;

    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}

fn load_config(path: &PathBuf) -> anyhow::Result<GameConfig> {
    let raw = fs::read_to_string(path)
        .with_context(|| format!("failed to read config {}", path.display()))?;
    let cfg: GameConfig = serde_json::from_str(&raw)
        .with_context(|| format!("invalid config json at {}", path.display()))?;
    Ok(cfg)
}

fn collect_missing_files(config: &GameConfig, game_root: &PathBuf) -> Vec<String> {
    let mut missing = Vec::new();

    let exe_path = resolve_relative_path(game_root, &config.relative_exe_path);
    if !exe_path.exists() {
        missing.push(config.relative_exe_path.clone());
    }

    for file in &config.integrity_files {
        let path = resolve_relative_path(game_root, file);
        if !path.exists() {
            missing.push(file.clone());
        }
    }

    missing
}

fn resolve_relative_path(base: &PathBuf, relative: &str) -> PathBuf {
    let clean = relative.strip_prefix("./").unwrap_or(relative);
    base.join(clean)
}
