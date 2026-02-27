# Auditoria Final - Wave 2 (Bloco B)

Data: 2026-02-27  
Escopo de referência: `ARCHITECTURE.md` e `FRONTEND_ARCHITECTURE.md`  
Baseline de commits do Bloco B: `cf17c5b..71ae01b`

## Resumo Executivo

- Itens avaliados no Bloco B: 12
- `DONE`: 12
- `PARTIAL`: 0
- `TODO`: 0

O Bloco B está concluído no escopo solicitado: os fluxos extraídos em frontend e orchestrator foram movidos para módulos dedicados, mantendo os adaptadores (controllers/commands/page composition) mais finos e preservando o comportamento observado.

## Checklist do Bloco B

| Item | Status | Evidências por arquivo |
|---|---|---|
| B1. Extrair use case de Hero Image para application | `DONE` | `apps/luthier/src/features/luthier/application/use-cases/hero-image.ts` centraliza fluxo de search/prepare/cycle/undo com `BackendCommandPort` e `NotifierPort`; `apps/luthier/src/features/luthier/controller-hero-actions.ts` atua como adaptador de estado/mensagens. |
| B2. Extrair use case de Winetricks para application | `DONE` | `apps/luthier/src/features/luthier/application/use-cases/winetricks.ts` concentra load catalog/add/remove/undo; `apps/luthier/src/features/luthier/controller-winetricks-actions.ts` faz wiring de estado/UI para o caso de uso. |
| B3. Extrair use case de file pickers/caminhos relativos para application | `DONE` | `apps/luthier/src/features/luthier/application/use-cases/file-pickers.ts` contém regras de normalização/relativização/seleção; `apps/luthier/src/features/luthier/controller-file-actions.ts` mantém integração de sinais e delega regras puras ao use case. |
| B4. Extrair use case de build/hash/test/create para application | `DONE` | `apps/luthier/src/features/luthier/application/use-cases/build-actions.ts` centraliza fluxo e transições de loading/status; `apps/luthier/src/features/luthier/controller-build-actions.ts` reduzido ao adaptador fino. |
| B5. Extrair efeitos de registry/file-browser de `page-effects.ts` | `DONE` | `apps/luthier/src/features/luthier/page-effects-registry-browser.ts` contém `importRegistryKeysFromRegFile`, `loadMountBrowserDirs`, `loadIntegrityBrowserEntries`, `resolveIntegrityFileBrowser`, `openIntegrityFileBrowser`, `openMountSourceBrowser`; `apps/luthier/src/features/luthier/page-effects.ts` compõe módulo extraído. |
| B6. Extrair regras runtime/performance derivadas (gamescope/winecfg) | `DONE` | `apps/luthier/src/features/luthier/page-effects-runtime-controls.ts` concentra `setWinecfgVirtualDesktopResolutionPart`, labels/help de runtime, lista/opções de gamescope e memos derivados; `apps/luthier/src/features/luthier/page-effects.ts` reaproveita a composição. |
| B7. Extrair efeitos de navegação/sidebar/theme | `DONE` | `apps/luthier/src/features/luthier/page-effects-navigation.ts` contém `goPrevTab`, `goNextTab`, `handleSidebarTabChange`, `cycleLocale`, `cycleTheme` e memos de sidebar; `apps/luthier/src/features/luthier/page-effects.ts` preserva a interface pública de `createLuthierPageEffects`. |
| B8. Introduzir doctor flow na camada application (orchestrator) | `DONE` | `bins/luthier-orchestrator/src/application/doctor_flow.rs` move orquestração sem formatação CLI e define estrutura de retorno (`DoctorFlowExecution`); `bins/luthier-orchestrator/src/application/mod.rs` exporta `doctor_flow`. |
| B9. Fazer `commands/doctor.rs` delegar para `doctor_flow` | `DONE` | `bins/luthier-orchestrator/src/commands/doctor.rs` passa a usar `execute_doctor_flow` para lógica e mantém camada de IO/human output, inclusive modo verbose via `as_verbose_payload()`. |
| B10. Extrair i18n/textos do splash para módulo próprio | `DONE` | `bins/luthier-orchestrator/src/splash/text.rs` contém `SplashLocale`, `SplashTextKey`, `t()`, `t_for()` e helpers de texto; `bins/luthier-orchestrator/src/splash/mod.rs` mantém composição/fluxo e importa o módulo. |
| B11. Extrair gerenciamento de child process do splash | `DONE` | `bins/luthier-orchestrator/src/splash/child_process.rs` encapsula `spawn_play_child()` e eventos/tipos de stream/exit; `bins/luthier-orchestrator/src/splash/mod.rs` apenas consome eventos no loop de progresso. |
| B12. Extrair parsing/mapeamento de logs de progresso do splash | `DONE` | `bins/luthier-orchestrator/src/splash/progress_events.rs` concentra `parse_ndjson_event()`, `apply_progress_from_log_event()`, `map_external_runtime_line_to_status()`; `bins/luthier-orchestrator/src/splash/mod.rs` permanece focado no fluxo de janelas e loop principal. |

## Evidências Complementares (Commits da Wave 2 / Bloco B)

1. `cf17c5b` - `refactor(frontend): extract hero image use case`
2. `f8a9ff3` - `refactor(frontend): extract winetricks use case`
3. `975298f` - `refactor(frontend): extract file pickers use case`
4. `5fbef97` - `refactor(frontend): extract build actions use case`
5. `36a4d75` - `refactor(frontend): split registry/browser page effects`
6. `de84bea` - `refactor(frontend): split runtime controls page effects`
7. `e8379ac` - `refactor(frontend): split navigation page effects`
8. `4a074a7` - `refactor(orchestrator): add doctor flow in application`
9. `a964cc8` - `refactor(orchestrator): delegate doctor command to application flow`
10. `0d1e6f6` - `refactor(splash): extract localized text module`
11. `178af3b` - `refactor(splash): extract child process module`
12. `71ae01b` - `refactor(splash): extract progress event mapping module`

## Riscos Remanescentes

1. Resíduo de tipos antigos no splash state
Evidência: `bins/luthier-orchestrator/src/splash/state.rs` ainda define `ChildStream` e `ChildEvent`, enquanto `mod.rs` usa `child_process::{ChildProcessStream, ChildProcessEvent}`. Isso já aparece como warning de `dead_code` no `cargo check`.

2. Cobertura de testes para módulos recém-extraídos ainda não está explícita
Evidência: novos módulos de caso de uso/frontend (`application/use-cases/*.ts`) e de parsing do splash (`splash/progress_events.rs`) não têm, nesta auditoria, suíte dedicada visível ao lado dos módulos.

3. `page-effects.ts` e `splash/mod.rs` ainda são pontos centrais de composição com volume relevante
Evidência: embora mais finos e compostos por submódulos, ambos permanecem como hubs de integração e podem acumular crescimento futuro sem disciplina de extração incremental.

## Próximos Passos Mínimos

1. Remover/ajustar os tipos legados de child process em `bins/luthier-orchestrator/src/splash/state.rs` para eliminar warnings e reduzir ambiguidade.
2. Adicionar testes unitários focados nos novos casos de uso frontend (`hero-image`, `winetricks`, `file-pickers`, `build-actions`) e no parser/mapeador de progresso do splash (`progress_events.rs`).
3. Manter a regra de composição fina em `page-effects.ts` e `splash/mod.rs`: qualquer novo fluxo deve nascer em módulo dedicado e apenas ser conectado nesses arquivos.
