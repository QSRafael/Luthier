# Luthier

Luthier is a Linux desktop application (Tauri + SolidJS) that builds a portable native Linux launcher next to a Windows game's `.exe`.

The generated launcher (internally called **Luthier Orchestrator**) reads an embedded configuration payload, validates the host environment, prepares Wine/Proton prefix/runtime state, applies compatibility settings, and launches the game with optional wrappers such as Gamescope, MangoHud, and GameMode.

## Project Status

This repository is actively developed and already supports an end-to-end local workflow:
- author game profiles in the Luthier app
- generate a native launcher with embedded payload
- inspect config (`--show-config`), run diagnostics (`--doctor`), configure runtime toggles (`--config`), open `winecfg` (`--winecfg`), and launch (`--play`)
- use a splash screen with pre-launch progress, optional quick config, and post-game feedback UI

Open work is tracked in:
- [context.md](./context.md) (product/spec, Portuguese)
- [debito.md](./debito.md) (current gaps, technical debt, and recommended next steps)

## High-Level Architecture

### 1. Luthier (desktop app)
- Linux desktop app built with Tauri + SolidJS
- Builds and validates `GameConfig`
- Computes hashes, extracts icons, imports `.reg`, prepares hero images
- Copies a base `luthier-orchestrator` binary and injects the JSON payload

### 2. Luthier Orchestrator (generated launcher)
- Native Linux executable placed next to the Windows game executable
- Reads its own embedded payload
- Runs doctor/runtime selection and dependency checks
- Prepares prefix and mounts
- Applies registry and part of `winecfg` overrides
- Launches the game with configured wrappers/runtime
- Emits NDJSON logs for diagnostics and AI-assisted support

### 3. Shared Rust crates
- `luthier-orchestrator-core`: config models, doctor/prefix/trailer/injector utilities
- `luthier-core`: reusable backend logic for the Luthier app and CLI tooling

## Repository Layout

```text
apps/luthier/                    # Tauri + SolidJS desktop app (frontend + Rust backend)
bins/luthier-orchestrator/       # Generated launcher runtime (internal name)
bins/luthier-cli/                # CLI helpers for local hash/test/create flows
bins/luthier-orchestrator-injector/
crates/luthier-core/             # Local backend logic shared by app/CLI
crates/luthier-orchestrator-core/# Shared runtime models and execution utilities
scripts/                         # Quality checks and local tooling
.github/workflows/ci.yml         # CI (frontend + Rust core)
docs/                            # Technical logs/checkpoints (mostly Portuguese)
context.md                       # Product spec / architecture / acceptance criteria
debito.md                        # Current debt / missing work vs spec
```

## Prerequisites (Linux)

### Required (development)
- Rust toolchain (`cargo`, `rustc`)
- Node.js 20+
- npm

### Required for the Tauri app (local desktop dev/build)
You need Linux GUI/webkit/GTK development packages installed (varies by distro). This repository includes local compatibility helpers (`pkgconfig/`, `libshims/`) used by the provided scripts, but host packages are still required.

### Optional but recommended
- `mise` (the helper scripts auto-detect it)

## Quick Start

### 1. Quality checks (recommended first)
```bash
./scripts/check-quality.sh
```

Run only frontend checks:
```bash
./scripts/check-frontend-quality.sh
```

Run Rust checks (excluding Tauri backend system deps):
```bash
./scripts/check-rust-quality.sh --exclude-tauri
```

### 2. Run Luthier frontend only (browser)
```bash
cd apps/luthier
npm install
npm run dev
```

### 3. Run the full Luthier desktop app (Tauri)
```bash
cd apps/luthier
npm install
npm run tauri:dev
```

### 4. Build the Luthier desktop app (no bundle)
```bash
./build-luthier-e-abrir.sh
```

### 5. Run the frontend on LAN (UI-only testing)
```bash
./rodar-luthier-lan.sh
# Optional: PORT=1421 ./rodar-luthier-lan.sh
```

## Common Developer Workflows

### Build the orchestrator binary directly
```bash
cargo build -p luthier-orchestrator
cargo build -p luthier-orchestrator --release
```

### Use the CLI helpers
```bash
cargo run -p luthier-cli -- --help
cargo run -p luthier-orchestrator -- --help
```

### Prepare the orchestrator base binary used by the app
```bash
cd apps/luthier
./scripts/prepare-luthier-orchestrator-base.sh debug
./scripts/prepare-luthier-orchestrator-base.sh release
```

## Notes for Publishing / GitHub

- The project brand is **Luthier**.
- `orchestrator` remains the internal technical name for the generated runtime binary/component.
- `context.md` and most technical planning/checkpoint docs are in Portuguese.
- `debito.md` tracks gaps vs the planned MVP and post-MVP scope.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT — see [LICENSE](./LICENSE).
