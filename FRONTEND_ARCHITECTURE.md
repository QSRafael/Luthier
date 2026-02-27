# Luthier Frontend Refactor Target Architecture (Clean Architecture)

## Goal
Refactor `apps/luthier/src` (SolidJS + TypeScript frontend) into clearer layers and modules, reducing the monolithic controller/page sections while preserving current behavior, payload compatibility, and UI flow.

This is a target architecture map for incremental refactoring. It is not a product spec.

## Scope
Included:
- `apps/luthier/src/features/luthier/**`
- `apps/luthier/src/components/form/**` (only where tightly coupled to feature complexity)
- `apps/luthier/src/api/tauri.ts` (adapter integration boundary)
- `apps/luthier/src/models/config.ts` (shared frontend config model)
- `apps/luthier/src/i18n.ts` (only when needed for boundary alignment)
- `apps/luthier/src/App.tsx`, `apps/luthier/src/main.tsx` (entrypoint cleanup)

Out of scope for first pass:
- visual redesign
- CSS/theme redesign
- Rust/Tauri backend refactor (`src-tauri`)
- payload schema redesign
- replacing SolidJS patterns already working unless needed for architecture boundaries

## Current Hotspots (observed)
Largest frontend files (approx):
- `features/luthier/useLuthierController.ts` (~1479 lines)
- `features/luthier/sections/game-tab.tsx` (~986)
- `features/luthier/LuthierPage.tsx` (~889)
- `features/luthier/sections/dependencies-tab.tsx` (~704)
- `features/luthier/sections/performance-tab.tsx` (~522)
- `components/form/form-controls-lists.tsx` (~421)
- `features/luthier/luthier-field-validation.ts` (~412)

Main coupling problems:
- `useLuthierController.ts` mixes state + derived values + domain validation + backend I/O + notifications + undo flows + UI behavior.
- `LuthierPage.tsx` holds large dialog/draft state and page-level orchestration.
- large section files contain both rendering and local validation/interaction logic.
- direct usage of `api/tauri` and `solid-sonner` from the controller creates infrastructure coupling.
- some domain-like logic is in JSX files (`review-tab` summary building, path/feature helpers in `luthier-page-shared.tsx`).

## Architectural Principles (frontend)
- Keep domain/application logic UI-framework-agnostic where practical.
- `domain/` must not import `solid-js`, UI components, `solid-sonner`, or `api/tauri`.
- `application/` defines use cases and ports; it must not depend on UI components.
- `infrastructure/` implements ports (Tauri API calls, toast adapter, local storage).
- `presentation/` (or existing feature files) contains Solid components/hooks and composes application/domain pieces.
- Refactor incrementally with 1–2 files per step and preserve current behavior.

## Target Layering for `features/luthier`

### 1) Domain (pure business rules / pure transforms)
`apps/luthier/src/features/luthier/domain/`
- `summary-builder.ts`
  - builds compact review summary rows/chips from `GameConfig` + UI context hints
- `create-executable-guards.ts`
  - computes block reasons and validation messages for create action
- `paths.ts` (optional later)
  - pure path helpers currently split between `luthier-controller-utils.ts` and `luthier-page-shared.tsx`
- `feature-state.ts` (optional later)
  - feature-state mapping helpers (`enabled/mandatory/build`)
- `validation-rules.ts` (optional later)
  - pure validation rules now in `luthier-field-validation.ts` (this file may remain as domain if renamed only)

Rules:
- no `solid-js`
- no JSX
- no `toast`
- no `invokeCommand`

### 2) Application (use cases / orchestration contracts)
`apps/luthier/src/features/luthier/application/`
- `ports.ts`
  - backend commands port, notifier port, storage port (if needed), clipboard port (optional)
- `use-cases/` (incremental, not mandatory in first pass)
  - `hero-image.ts`
  - `winetricks.ts`
  - `file-pickers.ts`
  - `build-actions.ts`
  - `registry-import.ts`
- `types.ts` (or `application.types.ts`)
  - app-layer contracts and typed operation results not tied to JSX

Rules:
- no UI components
- no JSX
- no direct `solid-sonner`
- no direct import from `../../api/tauri` (must go through ports/adapters)
- `solid-js` should be avoided here; use plain TS functions where possible

### 3) Infrastructure (adapters)
`apps/luthier/src/features/luthier/infrastructure/`
- `luthier-backend-api.ts`
  - adapter over `apps/luthier/src/api/tauri.ts`
- `sonner-notifier.ts`
  - wraps `toast`/Undo action support
- `local-preferences.ts` (optional later)
  - wraps localStorage for feature-specific preferences/cache metadata

Rules:
- may import `api/tauri`, `solid-sonner`, browser APIs
- no JSX (prefer plain TS adapters)

### 4) Presentation (Solid components/hooks)
Current folder remains mostly valid:
- `useLuthierController.ts` (target: composition root of feature-level state/actions)
- `LuthierPage.tsx` (target: shell/layout composition)
- `sections/*.tsx` (target: smaller presentation components)
- `AppSidebar.tsx`
- `luthier-page-shared.tsx` (can be split into `*-shared.ts` + presentational bits later)

Presentation responsibilities:
- Solid signals/memos/effects
- component composition
- dialog state wiring
- event handlers that call application/domain/infrastructure composition

## Keep / Rename / Reclassify Existing Files (pragmatic)

### Keep (already useful)
- `luthier-controller-utils.ts` (good candidate for split later; contains many pure helpers)
- `luthier-field-validation.ts` (already mostly domain-like; may be reclassified without major rewrite)
- `luthier-copy*.ts` and `luthier-copy.validation.*.ts` (i18n catalogs)
- `sections/winecfg/*` (already split by subsection)
- `components/form/*` split files (good direction)

### Reclassify conceptually (later)
- `luthier-page-shared.tsx`
  - contains both JSX components (`AccordionSection`, `SwitchChoiceCard`) and pure helpers (`parseWxH`, `featureStateEnabled`, path helpers)
  - target split:
    - `presentation/luthier-page-widgets.tsx`
    - `domain/feature-state.ts` / `domain/paths.ts` / `domain/display.ts`

## Proposed Incremental Refactor Strategy (frontend)

### Phase F0 - Architecture doc
- Create this file (`FRONTEND_ARCHITECTURE.md`)

### Phase F1 - Foundation (types, errors, ports, adapters, pure domain helpers)
- Add frontend feature error normalization (`luthier-errors.ts`)
- Add application types and ports
- Add backend API adapter + notifier adapter
- Extract pure summary and create guards logic from JSX/controller

### Phase F2 - Controller decomposition (`useLuthierController.ts`)
Split by responsibility using helper modules (no JSX):
- state initialization and signals
- computed/memos
- status/toast handling
- hero image actions
- winetricks actions
- file + picker + hash/icon actions
- build/test/create actions
- config patch helpers

Goal: `useLuthierController.ts` becomes a composition hook, not a monolith.

### Phase F3 - `LuthierPage.tsx` decomposition
- extract dialog state/drafts
- extract page effects (toasts, sidebar close, status plumbing)
- extract dialog JSX to `LuthierDialogs.tsx`
- keep page as shell/layout orchestrator

### Phase F4 - Large section decomposition
Priority:
1. `game-tab.tsx`
2. `dependencies-tab.tsx`
3. `review-tab.tsx`
4. `performance-tab.tsx`
5. `launch-environment-tab.tsx` (if still needed)

Extract cohesive panels/subcomponents only (2-file steps).

### Phase F5 - `components/form` cleanup
- extract repeated list/table/dialog rendering primitives from `form-controls-lists.tsx`
- keep `FormControls.tsx` as stable barrel

### Phase F6 - Entry points and boundary audit
- clean `App.tsx` / `main.tsx`
- boundary review to ensure domain/application do not import UI/adapters incorrectly

## Dependency Direction (frontend)
- `presentation` -> `domain`
- `presentation` -> `application`
- `presentation` -> `infrastructure` (preferably via composed instances / adapters)
- `application` -> `domain`
- `application` -> `ports`
- `infrastructure` implements `application` ports
- `domain` -> no dependencies on presentation/infrastructure/framework

## Practical Constraints / Notes
- Solid reactivity can stay in presentation helpers if extraction to pure TS would overcomplicate a step.
- Do not force generic abstractions early; preserve velocity.
- Payload compatibility is mandatory (`GameConfig` shape and semantics).
- UI behavior (toasts, undo, loading states) must not regress during refactor.

## Success Criteria
- `npm run typecheck` passes after each step.
- `npm run build` passes after steps touching JSX/page/sections.
- `useLuthierController.ts` and `LuthierPage.tsx` shrink substantially.
- Business rules become testable/pure modules (domain/application).
- Tauri and Sonner calls are isolated to infrastructure/presentation edges.

## Non-Goals (first pass)
- Rewriting all UI components to a new design system
- Changing translations/copy semantics
- Reorganizing every shared component outside the Luthier feature
- Replacing Solid signals with another state management approach
