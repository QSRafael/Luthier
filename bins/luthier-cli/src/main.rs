use std::fs;
use std::path::{Path, PathBuf};

use anyhow::Context;
use clap::{Parser, Subcommand};
use luthier_core::{
    create_orchestrator_binary, sha256_file, validate_game_config, CreateOrchestratorRequest,
};
use luthier_orchestrator_core::{doctor::run_doctor, prefix::build_prefix_setup_plan, GameConfig};

#[derive(Debug, Parser)]
#[command(name = "luthier-cli")]
#[command(about = "CLI utilities for Luthier")]
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
    validate_game_config(&config)?;

    let missing_files = collect_missing_files(&config, &game_root)?;
    let doctor = run_doctor(Some(&config));
    let prefix_plan = build_prefix_setup_plan(&config)?;

    let status = if missing_files.is_empty()
        && !matches!(
            doctor.summary,
            luthier_orchestrator_core::doctor::CheckStatus::BLOCKER
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

fn collect_missing_files(config: &GameConfig, game_root: &Path) -> anyhow::Result<Vec<String>> {
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

fn resolve_relative_path(base: &Path, relative: &str) -> anyhow::Result<PathBuf> {
    let normalized = normalize_relative_payload_path(relative)?;
    Ok(base.join(normalized))
}

fn normalize_relative_payload_path(raw: &str) -> anyhow::Result<PathBuf> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        anyhow::bail!("path is empty");
    }

    let normalized = trimmed.replace('\\', "/");
    if normalized.starts_with('/') || has_windows_drive_prefix(&normalized) {
        anyhow::bail!("absolute path is not allowed: {raw}");
    }

    let mut out = PathBuf::new();
    for part in normalized.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }

        if part == ".." {
            anyhow::bail!("path traversal is not allowed: {raw}");
        }

        out.push(part);
    }

    if out.as_os_str().is_empty() {
        anyhow::bail!("path resolves to empty value: {raw}");
    }

    Ok(out)
}

fn has_windows_drive_prefix(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic()
}
