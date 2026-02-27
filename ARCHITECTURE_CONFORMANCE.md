# Architecture Conformance Audit

Date: 2026-02-27
Repository snapshot: `dd3666b`

Legend:
- `DONE`: implemented and observable in code structure/usage.
- `PARTIAL`: implemented in part, but with relevant gaps versus target architecture.
- `TODO`: not implemented yet.

## Checklist: `ARCHITECTURE.md`

### 1) Goal and Scope (Rust/Tauri first)
- `DONE` Refactor moved Rust/Tauri code to layered modules across the scoped components.
  Evidence: `apps/luthier/src-tauri/src/{application,domain,infrastructure,models,facade.rs,error.rs,main.rs,lib.rs}`, `bins/luthier-orchestrator/src/{application,domain,services,infrastructure,splash,commands,main.rs}`, `crates/luthier-core/src/{application,domain,infrastructure,error.rs,models.rs,lib.rs}`, `crates/luthier-orchestrator-core/src/doctor/{mod.rs,models.rs,host_probe.rs,dependency_checks.rs,runtime_selection.rs,status_policy.rs}`.
- `PARTIAL` Frontend was out of first Rust/Tauri pass, but incremental frontend architecture work also happened (good progress, not fully complete).
  Evidence: `apps/luthier/src/features/luthier/**`, `apps/luthier/src/components/form/**`.

### 2) Architectural Principles
- `DONE` Tauri usage remains at edge in backend command entrypoint.
  Evidence: `apps/luthier/src-tauri/src/main.rs` (all `#[tauri::command]` and `spawn_blocking`), no `tauri::` usage in `apps/luthier/src-tauri/src/application/**` or `apps/luthier/src-tauri/src/domain/**`.
- `DONE` Orchestrator services/domain/application do not import Tauri/CLI formatting concerns.
  Evidence: no `tauri::`/`clap::`/`println!` matches in `bins/luthier-orchestrator/src/{services,application,domain}`; CLI output concentrated in `bins/luthier-orchestrator/src/commands/**` and `main.rs`.
- `PARTIAL` Infrastructure details are modularized, but several use cases/flows still call infrastructure modules directly instead of depending only on ports.
  Evidence: `apps/luthier/src-tauri/src/application/use_cases/*.rs` importing `crate::infrastructure::*`; `bins/luthier-orchestrator/src/application/{play_flow.rs,winecfg_flow.rs}` importing `crate::infrastructure::*`.
- `DONE` Payload compatibility is preserved through existing DTO/config paths.
  Evidence: `apps/luthier/src-tauri/src/models/dto.rs`, `apps/luthier/src-tauri/src/models/registry.rs`, `crates/luthier-orchestrator-core/src/config.rs`.

### 3) Target Layers by Component

#### 3.1 `luthier-backend`
- `DONE` Target file/module layout exists.
  Evidence: `apps/luthier/src-tauri/src/{main.rs,lib.rs,error.rs,facade.rs,models/mod.rs,models/dto.rs,models/hero.rs,models/registry.rs,application/mod.rs,application/ports.rs,application/use_cases/*.rs,domain/mod.rs,domain/validation.rs,domain/paths.rs,infrastructure/mod.rs,infrastructure/*.rs}`.
- `DONE` `spawn_blocking` is kept in interface layer.
  Evidence: `apps/luthier/src-tauri/src/main.rs`.
- `DONE` Use cases do not import Tauri directly.
  Evidence: `apps/luthier/src-tauri/src/application/use_cases/*.rs`.
- `PARTIAL` Ports exist but are not uniformly used as the only dependency boundary for use cases.
  Evidence: `apps/luthier/src-tauri/src/application/ports.rs` plus direct infra imports in `apps/luthier/src-tauri/src/application/use_cases/{create_executable.rs,import_registry.rs,prepare_hero.rs,search_hero.rs,extract_icon.rs,winetricks_available.rs,list_fs.rs,test_configuration.rs}`.

#### 3.2 `luthier-orchestrator`
- `DONE` Root split into `commands`, `application`, `domain`, `services`, `infrastructure`, `splash`.
  Evidence: `bins/luthier-orchestrator/src/{commands,application,domain,services,infrastructure,splash,main.rs}`.
- `DONE` Runtime override rules moved to `application` and root shim removed.
  Evidence: `bins/luthier-orchestrator/src/application/runtime_overrides.rs`, `bins/luthier-orchestrator/src/main.rs` (no `mod overrides;`), deleted `bins/luthier-orchestrator/src/overrides.rs`.
- `DONE` Domain foundation added (`errors`, `feature_policy`, `models`).
  Evidence: `bins/luthier-orchestrator/src/domain/{mod.rs,errors.rs,feature_policy.rs,models.rs}`.
- `DONE` Process adapter added and consumed by application/services.
  Evidence: `bins/luthier-orchestrator/src/infrastructure/process_adapter.rs`, usages in `bins/luthier-orchestrator/src/application/{play_flow.rs,winecfg_flow.rs}`, `bins/luthier-orchestrator/src/services/{registry_apply_service.rs,winecfg_apply_service.rs,script_runner.rs}`.
- `DONE` `play` command thinned to invoke application flow.
  Evidence: `bins/luthier-orchestrator/src/commands/play.rs`, `bins/luthier-orchestrator/src/application/play_flow.rs`.
- `PARTIAL` Splash split exists but large modules remain and dedicated stabilization phase is still open.
  Evidence: `bins/luthier-orchestrator/src/splash/{mod.rs,renderer.rs,state.rs,input.rs,theme.rs,assets.rs}` with high LOC in `mod.rs` and `renderer.rs`.
- `TODO` Dedicated `doctor_flow.rs` is not present.
  Evidence: missing `bins/luthier-orchestrator/src/application/doctor_flow.rs`.

#### 3.3 `luthier-core`
- `DONE` Target structure exists (`application`, `domain`, `infrastructure`, `models`, `error`).
  Evidence: `crates/luthier-core/src/{application/*.rs,domain/*.rs,infrastructure/*.rs,models.rs,error.rs,lib.rs}`.
- `PARTIAL` `lib.rs` acts as facade but contains more than pure re-export surface (public wrappers + large tests).
  Evidence: `crates/luthier-core/src/lib.rs`.

#### 3.4 `luthier-orchestrator-core`
- `DONE` Doctor split matches target modules including `host_probe` extraction.
  Evidence: `crates/luthier-orchestrator-core/src/doctor/{mod.rs,models.rs,host_probe.rs,dependency_checks.rs,runtime_selection.rs,status_policy.rs}`.
- `DONE` `run_doctor` remains in `mod.rs` as facade.
  Evidence: `crates/luthier-orchestrator-core/src/doctor/mod.rs`.

### 4) Dependency Direction
- `DONE` No Tauri imports leaked into pure core crates.
  Evidence: no `tauri::` usage in `crates/luthier-core/src/**` and `crates/luthier-orchestrator-core/src/**`.
- `PARTIAL` Application layers still depend directly on infrastructure modules in several places (instead of trait-only boundaries).
  Evidence: `apps/luthier/src-tauri/src/application/use_cases/*.rs`, `bins/luthier-orchestrator/src/application/{play_flow.rs,winecfg_flow.rs}`.
- `PARTIAL` Services mostly pure, but one service still depends on infrastructure path helper.
  Evidence: `bins/luthier-orchestrator/src/services/integrity_service.rs` imports `crate::infrastructure::paths::resolve_relative_path`.

### 5) Refactor Strategy Progress
- `DONE` Step 1 (new errors/types first) implemented in orchestrator and frontend feature foundations.
  Evidence: `bins/luthier-orchestrator/src/domain/errors.rs`, `apps/luthier/src/features/luthier/errors.ts`.
- `DONE` Step 2 (extract pure helpers/services) strongly advanced.
  Evidence: `crates/luthier-orchestrator-core/src/doctor/host_probe.rs`, `apps/luthier/src/features/luthier/domain/{summary-builder.ts,create-executable-guards.ts,validation-rules.ts,page-shared-helpers.ts}`, `apps/luthier/src/components/form/form-controls-list-primitives.tsx`.
- `PARTIAL` Step 3 (move orchestration into application) is in progress but not uniformly isolated from infrastructure.
  Evidence: `bins/luthier-orchestrator/src/application/{play_flow.rs,winecfg_flow.rs,runtime_overrides.rs}` plus direct infra imports.
- `PARTIAL` Step 4 (thin framework entry points) is mostly done, with remaining complexity in some adapters/effects layers.
  Evidence: thin `bins/luthier-orchestrator/src/main.rs` and `apps/luthier/src-tauri/src/main.rs`; heavier flow logic remains in application modules.
- `PARTIAL` Step 5 (split splash last) started and partially delivered.
  Evidence: `bins/luthier-orchestrator/src/splash/**` split exists; large files remain.
- `PARTIAL` Step 6 (preserve behavior with continuous compile checks) appears maintained in commits; full environment validation is currently limited by missing Node/npm.
  Evidence: Rust modules compile-oriented refactors; frontend commands cannot run in current environment (see validation section below).

### 6) Success Criteria
- `PARTIAL` Rust side is structurally aligned; full workspace check status recorded in this audit run.
  Evidence: command output in this audit execution.
- `PARTIAL` “No Tauri imports inside pure services/use-cases” is true for orchestrator services and backend domain/use-cases relative to Tauri, but use-case-to-infrastructure coupling remains.
  Evidence: no `tauri::` in `bins/luthier-orchestrator/src/{services,application,domain}` and `apps/luthier/src-tauri/src/application/**`; direct infra imports noted above.
- `DONE` Large monoliths were reduced in key frontend/orchestrator hotspots.
  Evidence: `apps/luthier/src/features/luthier/useLuthierController.ts` (239 LOC), `apps/luthier/src/features/luthier/LuthierPage.tsx` (184 LOC), decomposed section files under `apps/luthier/src/features/luthier/sections/**`.

## Checklist: `FRONTEND_ARCHITECTURE.md`

### 1) Scope and Principles
- `DONE` Scope areas are actively refactored (`features/luthier`, `components/form`), preserving incremental style.
  Evidence: `apps/luthier/src/features/luthier/**`, `apps/luthier/src/components/form/**`.
- `DONE` Domain folder remains free of SolidJS/UI runtime imports.
  Evidence: `apps/luthier/src/features/luthier/domain/{summary-builder.ts,create-executable-guards.ts,page-shared-helpers.ts,validation-rules.ts}`.
- `DONE` Infrastructure adapters host `invokeCommand` and `toast` concerns.
  Evidence: `apps/luthier/src/features/luthier/infrastructure/luthier-backend-api.ts`, `apps/luthier/src/features/luthier/infrastructure/sonner-notifier.ts`.
- `PARTIAL` Application layer has contracts (`ports`, `types`) but not full `use-cases/` folder rollout.
  Evidence: `apps/luthier/src/features/luthier/application/{ports.ts,types.ts}`; missing `apps/luthier/src/features/luthier/application/use-cases/*`.

### 2) Target Layering for `features/luthier`
- `DONE` Domain pure modules added for summary, create guards, validation, shared path/feature helpers.
  Evidence: `apps/luthier/src/features/luthier/domain/{summary-builder.ts,create-executable-guards.ts,validation-rules.ts,page-shared-helpers.ts}`.
- `PARTIAL` Optional domain files (`paths.ts`, `feature-state.ts`) are conceptually covered but not yet named as target files.
  Evidence: helper logic currently in `apps/luthier/src/features/luthier/domain/page-shared-helpers.ts`.
- `PARTIAL` Application use-case layer remains lightweight and not yet split into dedicated action modules under `application/use-cases/`.
  Evidence: `apps/luthier/src/features/luthier/application/{ports.ts,types.ts}` only.
- `DONE` Presentation decomposition is substantial: controller/page/sections/dialog splits are in place.
  Evidence: `apps/luthier/src/features/luthier/{controller-*.ts,page-effects.ts,page-dialog-state.ts,LuthierPage.tsx,LuthierDialogs.tsx,sections/**}`.

### 3) Keep / Rename / Reclassify
- `DONE` `field-validation.ts` reclassified as compatibility barrel; pure rules moved to domain.
  Evidence: `apps/luthier/src/features/luthier/field-validation.ts`, `apps/luthier/src/features/luthier/domain/validation-rules.ts`.
- `DONE` `luthier-page-shared.tsx` separated into widgets vs pure helpers.
  Evidence: `apps/luthier/src/features/luthier/luthier-page-widgets.tsx`, `apps/luthier/src/features/luthier/page-shared.tsx`, `apps/luthier/src/features/luthier/domain/page-shared-helpers.ts`.
- `DONE` Form list/table reusable primitives extracted.
  Evidence: `apps/luthier/src/components/form/form-controls-list-primitives.tsx`, `apps/luthier/src/components/form/form-controls-lists.tsx`.

### 4) Incremental Phase Progress (F0-F6)
- `DONE` F0 architecture doc exists.
  Evidence: `FRONTEND_ARCHITECTURE.md`.
- `DONE` F1 foundation largely implemented (errors, ports/types, infra adapters, pure domain helpers).
  Evidence: `apps/luthier/src/features/luthier/errors.ts`, `apps/luthier/src/features/luthier/application/{ports.ts,types.ts}`, `apps/luthier/src/features/luthier/infrastructure/{luthier-backend-api.ts,sonner-notifier.ts}`, `apps/luthier/src/features/luthier/domain/{summary-builder.ts,create-executable-guards.ts}`.
- `DONE` F2 controller decomposition completed with composition-style `useLuthierController`.
  Evidence: `apps/luthier/src/features/luthier/useLuthierController.ts`, `apps/luthier/src/features/luthier/controller-*.ts`.
- `PARTIAL` F3 page decomposition done, but `page-effects.ts` is still large and central.
  Evidence: `apps/luthier/src/features/luthier/{LuthierPage.tsx,LuthierDialogs.tsx,page-dialog-state.ts,page-effects.ts}`.
- `DONE` F4 large section decomposition is materially complete (many focused panels/subcomponents).
  Evidence: `apps/luthier/src/features/luthier/sections/**`.
- `DONE` F5 form controls cleanup achieved with reusable list primitives and stable barrel.
  Evidence: `apps/luthier/src/components/form/{FormControls.tsx,form-controls-lists.tsx,form-controls-list-primitives.tsx,form-list-dialog.tsx,form-list-table.tsx}`.
- `PARTIAL` F6 boundary audit and entrypoint cleanup is in progress; entrypoints are clean, but full enforcement is still ongoing.
  Evidence: `apps/luthier/src/{App.tsx,main.tsx}`, remaining cross-layer coupling noted above.

### 5) Frontend Success Criteria
- `TODO` Automated frontend validation (`npm run typecheck`, `npm run build`) cannot be executed in current environment due missing Node/npm.
  Evidence: command failure `npm: command not found`.
- `DONE` Controller and page monolith size reduction is achieved.
  Evidence: `apps/luthier/src/features/luthier/useLuthierController.ts` (239 LOC), `apps/luthier/src/features/luthier/LuthierPage.tsx` (184 LOC).
- `PARTIAL` Business rules moved to testable pure modules, but dedicated test coverage for new modules is not yet visible in this audit pass.
  Evidence: domain modules exist; no dedicated frontend domain test files identified under `apps/luthier/src/features/luthier/domain`.

## Remaining Risks
- High coupling risk: application/use-case modules still importing infrastructure modules directly can slow future adapter swaps and testing.
  Evidence: `apps/luthier/src-tauri/src/application/use_cases/*.rs`, `bins/luthier-orchestrator/src/application/{play_flow.rs,winecfg_flow.rs}`.
- Maintainability risk: splash remains large despite split (`mod.rs` + `renderer.rs` still heavy).
  Evidence: `bins/luthier-orchestrator/src/splash/{mod.rs,renderer.rs}`.
- Validation blind spot: frontend type/build checks are currently blocked in this environment.
  Evidence: missing `node`/`npm` in PATH.
- Boundary drift risk: isolated service-level infrastructure dependency still exists.
  Evidence: `bins/luthier-orchestrator/src/services/integrity_service.rs`.

## Minimal Next Steps
1. Introduce explicit application ports for orchestrator flows and migrate direct `crate::infrastructure::*` calls behind those ports.
   Evidence target: `bins/luthier-orchestrator/src/application/{play_flow.rs,winecfg_flow.rs}`.
2. Apply the same port-first migration across backend use cases that still import infrastructure modules directly.
   Evidence target: `apps/luthier/src-tauri/src/application/use_cases/*.rs`.
3. Continue splash decomposition by extracting rendering subdomains from `renderer.rs` and flow orchestration from `mod.rs`.
   Evidence target: `bins/luthier-orchestrator/src/splash/{mod.rs,renderer.rs}`.
4. Run frontend checks in a Node-enabled environment and record the result in CI (or equivalent reproducible command runner).
   Evidence target: `apps/luthier` toolchain/CI config.
5. Add focused tests for pure frontend domain helpers (`validation-rules`, `summary-builder`, `create-executable-guards`) and runtime override/domain policy helpers in orchestrator.
   Evidence target: new test files near `apps/luthier/src/features/luthier/domain/**` and `bins/luthier-orchestrator/src/domain/**`.
