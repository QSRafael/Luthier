# Implementation Log

## 2026-02-24
- Bootstrap inicial do workspace Rust.
- Definição de crate `luthier-orchestrator-core` e binário `orchestrator`.
- Implementado:
  - modelos base (`GameConfig`, `FeatureState`, etc.) em `luthier-orchestrator-core`;
  - parser/injetor de trailer (`GOCFGv1 + len + sha256`) com testes unitários;
  - observabilidade NDJSON (`event_code`, `trace_id`, `span_id`) com teste;
  - CLI inicial do `orchestrator` com flags:
    - `--play`
    - `--config`
    - `--doctor`
    - `--verbose`
    - `--show-config`
    - `--lang <locale>`
  - implementação real de `--show-config` lendo o próprio executável.
- Bloqueio no ambiente desta sessão:
  - `cargo test` não completou por falha de acesso à `index.crates.io`.
- Próximo passo técnico:
- Fase 2 (Injector no App Luthier): copiar binário base e embutir payload;
- adicionar export de bundle de diagnóstico inicial.

## 2026-02-24 (checkpoint 02)
- Implementado `injector` no `luthier-orchestrator-core`:
  - `inject_from_files(...)` com validação de schema, injeção de trailer, escrita atômica, backup `.bak` e verificação pós-escrita.
  - `extract_config_from_file(...)` para leitura/verificação de payload embutido.
- Criado binário `luthier-orchestrator-injector` (CLI) com opções:
  - `--base`
  - `--config`
  - `--output`
  - `--no-backup`
  - `--no-exec-bit`
- Mantido padrão de log estruturado NDJSON com `event_code`, `trace_id`, `span_id`.
- Próximo passo técnico:
- integrar chamada do injector no backend do App Luthier (Tauri command);
- iniciar `doctor/discovery` no binário `orchestrator`.

## 2026-02-24 (checkpoint 03)
- Implementado `doctor` inicial em `luthier-orchestrator-core`:
  - discovery de runtime por ordem:
    - `PATH`
    - env vars (`PROTONPATH`, `STEAM_COMPAT_TOOL_PATHS`, `WINE`, `UMU_RUNTIME`)
    - paths padrão para Proton/Wine
  - avaliação de dependências com status `OK/WARN/BLOCKER/INFO`
  - aplicação de política do `GameConfig` quando disponível.
- `orchestrator --doctor` agora:
  - tenta ler config embutida;
  - roda doctor com/sem config;
  - imprime relatório JSON;
  - gera logs estruturados NDJSON (`GO-DR-*`).
- Próximo passo técnico:
- iniciar setup de prefix (fase 5) e wiring do fluxo `--play`.

## 2026-02-24 (checkpoint 04)
- Implementado módulo `prefix` em `luthier-orchestrator-core`:
  - `prefix_path_for_hash(exe_hash)` -> `~/.local/share/Luthier/prefixes/<hash>`
  - `build_prefix_setup_plan(config)` com comandos planejados e idempotência
  - `base_env_for_prefix(...)` com `WINEPREFIX` + `PROTON_VERB=run`
- `--doctor` atualizado:
  - agora retorna JSON com dois blocos:
    - `doctor`
    - `prefix_setup_plan` (quando há config embutida)
- Próximo passo técnico:
- executar de fato o plano do prefix com timeouts/erros estruturados;
- começar montagem de launch command (wrappers + runtime).

## 2026-02-24 (checkpoint 05)
- Criado crate `luthier-core` para backend do App Luthier:
  - `create_orchestrator_binary(...)` (injeção usando `luthier-orchestrator-core::injector`);
  - `sha256_file(...)`;
  - validações de paths relativos no payload;
  - utilitário `to_relative_inside_game_root(...)`.
- `luthier-orchestrator-core::injector` ganhou `inject_from_parts(...)` para uso direto do backend sem arquivo intermediário.
- Próximo passo técnico:
- ligar `luthier-core` ao `src-tauri` com comandos invocáveis pela UI;
- iniciar execução real do `PrefixSetupPlan` no Luthier Orchestrator.

## 2026-02-24 (checkpoint 06)
- Criado backend inicial do App Luthier em `apps/luthier/src-tauri`:
  - `create_executable(...)` (parse JSON -> `luthier-core` -> gera binário);
  - `hash_executable(...)` (SHA-256 do `.exe`).
- Estrutura preparada para virar `#[tauri::command]` sem reescrever regra de negócio.
- Próximo passo técnico:
- adicionar comandos Tauri reais;
- iniciar execução real do `PrefixSetupPlan` em `--play`.

## 2026-02-24 (checkpoint 07)
- `orchestrator --play` evoluiu de placeholder para preflight:
  - carrega config embutida obrigatoriamente;
  - roda `doctor` com política;
  - aborta com erro quando `summary == BLOCKER`;
  - gera `prefix_setup_plan`;
  - imprime JSON final de preflight.
- Ainda pendente em `--play`:
- execução real dos comandos de setup do prefix;
- montagem do comando final de launch do jogo.

## 2026-02-24 (checkpoint 08)
- Implementado executor de `PrefixSetupPlan` em `luthier-orchestrator-core::process`:
  - execução por comando com timeout;
  - status por etapa (`Skipped|Success|Failed|TimedOut`);
  - parada após falha obrigatória;
  - helper `has_mandatory_failures(...)`.
- `--play` atualizado:
  - executa plano de setup de prefix (ou dry-run com `LUTHIER_DRY_RUN=1`);
  - inclui resultado das etapas no JSON de saída;
  - aborta quando etapa obrigatória falha.
- Próximo passo técnico:
- montar comando final de launch (wrappers + runtime + exe) e fechar loop de execução.

## 2026-02-24 (checkpoint 09)
- `--play` agora executa fluxo completo de runtime:
  - valida integridade (`relative_exe_path` + `integrity_files`);
  - roda `doctor` e bloqueia em `BLOCKER`;
  - executa setup de prefix planejado;
  - executa `pre_launch` (bash) quando definido;
  - monta comando final com wrappers + runtime + args;
  - executa comando do jogo com `wait()` da thread principal;
  - executa `post_launch` quando definido.
- Launch command inclui:
  - seleção de runtime (`ProtonUmu`, `ProtonNative`, `Wine`);
  - wrappers: `gamescope`, `gamemoderun`, `mangohud`, wrappers customizados;
  - env protegido: `WINEPREFIX`, `PROTON_VERB` + custom vars com proteção de chave;
  - suporte a dry-run global com `LUTHIER_DRY_RUN=1`.
- Observabilidade:
  - eventos adicionais `GO-CFG-020`, `GO-PF-020`, `GO-SC-020`, `GO-SC-021`, `GO-LN-020`.
- Próximo passo técnico:
- integrar comandos Tauri reais (`#[tauri::command]`) e iniciar UI mínima para fluxo de gerar/testar.

## 2026-02-24 (checkpoint 10)
- Backend `src-tauri` agora possui wrappers de comando para integração UI:
  - `cmd_create_executable(...)`
  - `cmd_hash_executable(...)`
- Atributos `#[tauri::command]` foram preparados via `cfg_attr` com feature `tauri-commands`.
- Próximo passo técnico:
- criar bootstrap Tauri `main.rs` com `generate_handler!`;
- adicionar UI mínima (abas principais + revisão/gerar/testar).

## 2026-02-24 (checkpoint 11)
- Bootstrap Tauri criado em `src-tauri/src/main.rs`:
  - registra `cmd_create_executable` e `cmd_hash_executable` via `generate_handler!`.
  - fallback de execução quando feature `tauri-commands` não está ativa.
- `tauri.conf.json` mínimo adicionado para inicializar runtime/app window.
- Próximo passo técnico:
- iniciar frontend mínimo do Criador (estrutura de abas + formulário + revisão/gerar/testar).

## 2026-02-24 (checkpoint 12)
- Frontend mínimo do App Luthier implementado (`apps/luthier`):
  - Vite + Solid com abas:
    - Jogo
    - Runtime
    - Revisao e Gerar
  - ações na UI:
    - calcular hash (`cmd_hash_executable`)
    - testar config (`cmd_test_configuration`)
    - criar executável (`cmd_create_executable`)
- Backend `src-tauri` ganhou comando:
  - `test_configuration(...)` + wrapper `cmd_test_configuration(...)`
  - valida paths, checa arquivos obrigatórios, roda doctor e monta prefix plan.
- Próximo passo técnico:
- expandir UI para cobrir mais campos por aba;
- integrar i18n na UI e backend.

## 2026-02-24 (checkpoint 13)
- i18n inicial implementado no frontend (`apps/luthier/src/App.tsx`):
  - idiomas suportados:
    - `pt-BR`
    - `en-US`
  - seletor de idioma na UI;
  - persistência de preferência em `localStorage`.
- Textos principais internacionalizados:
  - título/subtítulo
  - abas
  - labels e tooltips da UI mínima
  - mensagens de status dos fluxos (`hash`, `test`, `create`).
- Próximo passo técnico:
- aplicar i18n no backend para mensagens retornadas por comandos.

## 2026-02-24 (checkpoint 14)
- Novo binário `luthier-cli` adicionado para testes por terminal:
  - `luthier-cli hash --exe <path>`
  - `luthier-cli test --config <config.json> --game-root <path>`
  - `luthier-cli create --base <orchestrator-base> --config <config.json> --output <path>`
- Com isso, o fluxo de validação/geração pode ser testado sem frontend e sem runtime Tauri.
- Próximo passo técnico:
- internacionalizar mensagens de erro/sucesso no backend (`src-tauri`).

## 2026-02-24 (checkpoint 15)
- Hotfix de compilação após teste real:
  - corrigido parse de `json_len` no trailer (`usize::try_from(u64)` explícito);
  - adicionada dependência `serde` no binário `orchestrator` para serialização de `LaunchCommandPlan`.
- Validação:
  - `cargo build --workspace` concluindo com sucesso no ambiente local.

## 2026-02-24 (checkpoint 16)
- Correções de revisão técnica e dívida:
  - `clippy -D warnings` limpo em todo workspace;
  - API de log refatorada com `LogIdentity`.
- Hardening de segurança em paths:
  - validação defensiva no `orchestrator` para impedir path absoluto/traversal em payload;
  - mesma normalização aplicada em `luthier-cli` e backend `src-tauri` no comando de teste.
- `--config` implementado no Luthier Orchestrator:
  - suporte a overrides opcionais por jogo:
    - `--set-mangohud on|off|default`
    - `--set-gamescope on|off|default`
    - `--set-gamemode on|off|default`
  - persistência em `~/.local/share/Luthier/overrides/<exe_hash>.json`;
  - aplicação automática dos overrides no `--play`.
- Wrappers e prefix:
  - wrapper custom `MandatoryOn` ausente agora bloqueia com erro explícito;
  - wrapper opcional ausente é ignorado sem quebrar o launch;
  - `build_prefix_setup_plan` passou a respeitar `winetricks OptionalOff/MandatoryOff`.
- Discovery/doctor:
  - busca de Proton ampliada para roots `steamapps/common`;
  - escolha de candidato melhorada por metadata de modificação;
  - validação de executabilidade para `wine`, `umu-run` e binários em `PATH`.
- Tauri alignment:
  - frontend ajustado para `@tauri-apps/api` v1;
  - `tauri.conf.json` migrado para schema v1 para compatibilidade com backend atual.
- Validação executada:
  - `cargo fmt --all`
  - `cargo build --workspace`
  - `cargo test --workspace --all-targets`
  - `cargo clippy --workspace --all-targets -- -D warnings`
