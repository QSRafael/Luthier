# Luthier Refactor Target Architecture (Clean Architecture)

## Goal
Refactor the Rust/Tauri portions of the repository into a layered structure with explicit boundaries, while preserving current behavior and payload compatibility.

This document is a refactor target map. It is not a final product spec.

## Scope (Rust/Tauri first)
- `apps/luthier/src-tauri` (`luthier-backend`)
- `bins/luthier-orchestrator`
- `crates/luthier-core` (already partially domain/application-like, but still monolithic)
- `crates/luthier-orchestrator-core` (especially `doctor.rs` and related runtime logic)

Frontend (`apps/luthier/src`) is out of scope for the first Clean Architecture pass except where API signatures force updates.

## Architectural Principles
- Domain/application layers must be pure Rust and framework-agnostic.
- Tauri (`tauri::`) stays at the edge (`main.rs` command handlers/adapters only).
- CLI (`clap`, stdout/stderr formatting) stays at the edge (`commands/`, `main.rs`).
- Infrastructure details (filesystem, HTTP, image decoding, PE parsing, process execution) must be behind explicit modules/ports.
- Preserve existing payload schema (`GameConfig`) and runtime behavior unless a prompt explicitly instructs a compatibility change.
- Keep intermediate steps compiling whenever possible.

## Target Layers by Component

### 1) `luthier-backend` (Tauri backend, currently monolithic `lib.rs`)

#### Current pain point
- `apps/luthier/src-tauri/src/lib.rs` mixes:
  - DTOs
  - use cases
  - validation orchestration
  - HTTP clients
  - image processing
  - PE icon extraction
  - registry import parsing
  - filesystem browsing
  - logging

#### Target structure
`apps/luthier/src-tauri/src/`
- `main.rs` (Tauri commands only; async wrappers + invoke registration)
- `lib.rs` (public facade exports only; no business logic)
- `error.rs` (backend error envelope + conversion helpers)
- `models/`
  - `mod.rs`
  - `dto.rs` (Tauri-facing input/output DTOs)
  - `hero.rs` (hero search/prepare internal structs)
  - `registry.rs` (registry import parse structs if needed)
- `application/`
  - `mod.rs`
  - `ports.rs` (traits for fs/http/image/process/path access as needed)
  - `use_cases/`
    - `mod.rs`
    - `create_executable.rs`
    - `hash_executable.rs`
    - `extract_icon.rs`
    - `search_hero.rs`
    - `prepare_hero.rs`
    - `test_configuration.rs`
    - `winetricks_available.rs`
    - `import_registry.rs`
    - `list_fs.rs`
- `domain/`
  - `mod.rs`
  - `validation.rs` (non-Tauri validation helpers specific to backend inputs)
  - `paths.rs` (relative path normalization helpers used locally)
- `infrastructure/`
  - `mod.rs`
  - `fs_repo.rs`
  - `http_client.rs`
  - `image_codec.rs`
  - `pe_icon_reader.rs`
  - `registry_parser.rs`
  - `winetricks_catalog.rs`
  - `logging.rs`
- `facade.rs` (glue used by `main.rs`, preserves current function signatures if desired)

Notes:
- `spawn_blocking` remains in `main.rs` (interface layer), not in use cases.
- Use cases must not import `tauri::`.

### 2) `luthier-orchestrator` (generated runtime binary)

#### Current pain point
- `launch.rs` is large and mixes planning + env mapping + applying registry/winecfg + script execution + validation.
- `commands/play.rs` orchestrates too much flow directly.
- `splash.rs` is large UI state machine (can be deferred to later refactor phase).

#### Target structure
`bins/luthier-orchestrator/src/`
- `main.rs` (CLI routing only)
- `cli.rs` (CLI args)
- `commands/` (IO/adapters for command entry points)
  - `play.rs`
  - `doctor.rs`
  - `winecfg.rs`
  - `config.rs`
  - `show_config.rs`
- `application/`
  - `mod.rs`
  - `play_flow.rs` (use-case orchestration for play)
  - `winecfg_flow.rs`
  - `doctor_flow.rs` (optional if keeping simple)
  - `runtime_overrides.rs` (business rules around applying overrides)
- `domain/`
  - `mod.rs`
  - `models.rs` (launch plan outputs / summaries if local to binary)
  - `errors.rs`
  - `feature_policy.rs` (feature-state decisions used by launcher)
- `services/` (pure Rust, no CLI/Tauri concerns)
  - `mod.rs`
  - `launch_plan_builder.rs`
  - `prefix_setup_service.rs`
  - `registry_apply_service.rs`
  - `winecfg_apply_service.rs`
  - `script_runner.rs`
  - `integrity_service.rs`
- `infrastructure/`
  - `mod.rs`
  - `process_adapter.rs` (wrapping `execute_external_command` if extracted)
  - `mounts_adapter.rs`
  - `payload_loader.rs` (can wrap current `payload.rs`)
  - `paths.rs` (existing path resolution)
- `splash/` (deferred large split)
  - `mod.rs`
  - `state.rs`
  - `renderer.rs`
  - `input.rs`
  - `theme.rs`
  - `assets.rs`

Notes:
- Keep behavior identical first; refactor for separation, not feature changes.
- `splash.rs` should be split in a dedicated phase because it is the largest file and easy to destabilize.

### 3) `luthier-core`

#### Current pain point
- `lib.rs` mixes validation rules + file operations + payload injection orchestration.

#### Target structure
`crates/luthier-core/src/`
- `lib.rs` (re-exports)
- `error.rs`
- `models.rs` (request/result structs)
- `application/`
  - `mod.rs`
  - `create_orchestrator_binary.rs`
  - `validate_game_config.rs`
  - `hash.rs`
- `domain/`
  - `mod.rs`
  - `validation_rules.rs`
  - `path_rules.rs`
- `infrastructure/`
  - `mod.rs`
  - `file_io.rs`
  - `injector_adapter.rs`

### 4) `luthier-orchestrator-core`

#### Current pain point
- `doctor.rs` is large and combines:
  - report models
  - host probing
  - dependency checks
  - runtime selection logic
  - policy/status computation

#### Target structure
`crates/luthier-orchestrator-core/src/doctor/`
- `mod.rs` (public `run_doctor` facade + reexports)
- `models.rs`
- `host_probe.rs`
- `dependency_checks.rs`
- `runtime_selection.rs`
- `status_policy.rs`

Similarly (optional later):
- `prefix/` module split if `prefix.rs` grows further.

## Dependency Direction (must preserve)
- `interface` -> `application` -> `domain`
- `interface` -> `infrastructure`
- `application` may depend on traits/ports and domain types
- `domain` depends on nothing framework-specific
- `services/` in orchestrator must not import `tauri::` and should not format CLI output

## Refactor Strategy (important for AI prompts)
1. Create new errors/types first.
2. Extract pure helpers/validation/services next.
3. Move use-case orchestration into `application` layer.
4. Thin the framework entry points (`main.rs`, Tauri commands).
5. Split large UI/splash module last.
6. Preserve public behavior and serialized payloads at each step.

## Non-Goals (for the first pass)
- No payload schema redesign.
- No feature additions.
- No frontend UI redesign.
- No logging protocol rename (`GO-*`) unless explicitly requested.

## Success Criteria for the Refactor
- `cargo build` passes for targeted crates after each prompt step.
- No Tauri imports inside pure services/use cases.
- Existing command behavior and payload compatibility preserved.
- Large monolithic files shrink substantially with clear module boundaries.
