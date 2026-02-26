# Historico de Checkpoints (extraido do context.md)

Este arquivo contem o historico completo de implementacao (checkpoints) que foi separado do `context.md` para reduzir ruido e melhorar a leitura da especificacao.

## 24) Progresso de Implementacao (checkpoint)

### 2026-02-24 - Checkpoint 01
Escopo implementado:
- Bootstrap do workspace Rust:
  - `Cargo.toml` raiz com membros:
    - `crates/luthier-orchestrator-core`
    - `bins/luthier-orchestrator`
- `luthier-orchestrator-core` criado com:
  - modelos base (`GameConfig`, `FeatureState`, runtime, winecfg, etc.);
  - parser/injetor de trailer (`GOCFGv1` + `json_len` + `sha256`);
  - observabilidade NDJSON (`event_code`, `trace_id`, `span_id`);
  - testes unitarios para trailer e observabilidade.
- `orchestrator` CLI criado com flags:
  - `--play`, `--config`, `--doctor`, `--verbose`, `--show-config`, `--lang`;
  - `--show-config` funcional lendo o proprio executavel.
- Estrutura inicial de docs e CI:
  - `.github/workflows/ci.yml`
  - `docs/implementation-log.md`
  - placeholder `apps/luthier/README.md`.

Bloqueio observado no ambiente desta sessao:
- `cargo test` nao concluiu por indisponibilidade de rede para baixar crates (`index.crates.io`).

Proximo checkpoint planejado:
- Implementar Fase 2 no App Luthier (injeção de payload no binario base).
- Adicionar comando de teste local no App Luthier usando o mesmo pipeline do Luthier Orchestrator sem gerar arquivo final.

### 2026-02-24 - Checkpoint 02
Escopo implementado:
- Fase 2 (parcial) entregue via utilitario CLI e modulo core:
  - novo modulo `injector` em `luthier-orchestrator-core`;
  - injeção de payload com:
    - validacao de `GameConfig` antes de embutir;
    - escrita atomica (tmp + rename);
    - backup `.bak` quando output ja existe;
    - marca de executavel (Unix);
    - verificacao pos-injecao comparando payload extraido.
- Novo binario `luthier-orchestrator-injector` para uso pelo App Luthier:
  - `--base`, `--config`, `--output`, `--no-backup`, `--no-exec-bit`.
- Testes unitarios adicionados no modulo `injector` (roundtrip + backup).

Proximo checkpoint planejado:
- Integrar `injector` ao backend Tauri (command `create_orchestrator_binary`).
- Comecar Fase 4 (`doctor/discovery`) no binario `orchestrator`.

### 2026-02-24 - Checkpoint 03
Escopo implementado:
- Fase 4 (parcial) no `orchestrator`:
  - `--doctor` agora funcional, com relatorio JSON.
- Novo modulo `doctor` em `luthier-orchestrator-core` com:
  - discovery de runtime por prioridade:
    - `PATH`
    - env vars (`PROTONPATH`, `STEAM_COMPAT_TOOL_PATHS`, `WINE`, `UMU_RUNTIME`)
    - paths padrao de Proton/Wine
  - avaliacao de componentes com status:
    - `OK`
    - `WARN`
    - `BLOCKER`
    - `INFO`
  - avaliacao de runtime conforme `runtime.strict` + `primary` + `fallback_order` quando houver config embutida.
- `--doctor` roda com ou sem config embutida:
  - sem config: diagnostico best-effort sem bloquear por politica;
  - com config: aplica regras de obrigatoriedade e pode gerar `BLOCKER`.

Proximo checkpoint planejado:
- Implementar setup inicial de prefix (fase 5), incluindo passos idempotentes e logs por etapa.
- Integrar comando de injeção no backend Tauri do App Luthier.

### 2026-02-24 - Checkpoint 04
Escopo implementado:
- Fase 5 (parcial) no `luthier-orchestrator-core`:
  - novo modulo `prefix` com:
    - `prefix_path_for_hash(exe_hash)`;
    - `build_prefix_setup_plan(config)` (wineboot/winetricks planejados);
    - `base_env_for_prefix(...)` com variaveis protegidas de execucao.
- `--doctor` atualizado no binario `orchestrator`:
  - inclui `prefix_setup_plan` no JSON final quando ha config embutida.

Proximo checkpoint planejado:
- Executar plano de prefix (nao apenas planejar), com timeout e retorno estruturado por etapa.
- Iniciar montagem do launch command final (wrappers + runtime + exe).

### 2026-02-24 - Checkpoint 05
Escopo implementado:
- Novo crate `luthier-core` para backend local do App Luthier:
  - `create_orchestrator_binary(...)` usando `inject_from_parts(...)`;
  - `sha256_file(...)` para hash de executavel;
  - validacao de paths relativos no payload (`relative_exe_path`, `integrity_files`, `folder_mounts`);
  - helper para normalizar caminho relativo dentro da pasta do jogo.
- `luthier-orchestrator-core::injector` atualizado com API de injeção por bytes (`inject_from_parts`) para evitar depender de arquivo temporario de config.

Proximo checkpoint planejado:
- Integrar `luthier-core` ao backend Tauri (`src-tauri`) com comandos de alto nivel para UI.
- Executar `PrefixSetupPlan` de forma real no Luthier Orchestrator com logs por etapa.

### 2026-02-24 - Checkpoint 06
Escopo implementado:
- Backend inicial do App Luthier em `apps/luthier/src-tauri`:
  - funcao `create_executable(...)`:
    - recebe JSON de config;
    - desserializa para `GameConfig`;
    - chama `luthier-core` para gerar o Luthier Orchestrator.
  - funcao `hash_executable(...)` para SHA-256 do executavel alvo.
- Arquitetura isolada:
  - regra de negocio continua em crates (`luthier-core` + `luthier-orchestrator-core`);
  - `src-tauri` atua como camada de adaptacao para futura exposicao de `#[tauri::command]`.

Proximo checkpoint planejado:
- Adicionar comandos Tauri reais no backend (`#[tauri::command]`) e conectar ao frontend.
- Implementar execucao real do `PrefixSetupPlan` no fluxo `--play` do Luthier Orchestrator.

### 2026-02-24 - Checkpoint 07
Escopo implementado:
- `--play` deixou de ser placeholder e agora executa preflight:
  - carrega config embutida (obrigatorio);
  - roda `doctor` com regras do perfil;
  - se houver `BLOCKER`, interrompe antes de qualquer launch;
  - gera e exibe `prefix_setup_plan`.
- Resultado atual do `--play`:
  - etapa de validacao/preparacao pronta;
  - launch do jogo ainda pendente.

Proximo checkpoint planejado:
- Executar comandos reais do `PrefixSetupPlan` com timeout e erro estruturado.
- Implementar montagem do comando final do jogo (wrappers + runtime + exe).

### 2026-02-24 - Checkpoint 08
Escopo implementado:
- Execucao real do `PrefixSetupPlan` adicionada via modulo `process`:
  - timeout por comando;
  - status estruturado por etapa:
    - `Skipped`
    - `Success`
    - `Failed`
    - `TimedOut`
  - bloqueio do fluxo apos falha obrigatoria.
- `--play` atualizado:
  - executa setup de prefix quando necessario;
  - inclui `prefix_setup_execution` no JSON de preflight;
  - aborta em falha obrigatoria.
- Modo de simulacao:
  - `LUTHIER_DRY_RUN=1` executa fluxo sem spawn real.

Proximo checkpoint planejado:
- Implementar montagem e spawn do launch command final (wrappers + runtime + exe).
- Incluir script `pre_launch` e `post_launch` no fluxo real.

### 2026-02-24 - Checkpoint 09
Escopo implementado:
- `--play` agora executa pipeline completo de runtime:
  - valida integridade de arquivos;
  - executa `doctor` com politica;
  - executa setup de prefix;
  - roda `pre_launch` (bash) quando definido;
  - monta e executa comando final do jogo;
  - roda `post_launch` quando definido.
- Montagem do launch command:
  - runtime selecionado por `doctor` (`ProtonUmu`, `ProtonNative`, `Wine`);
  - wrappers:
    - `gamescope`
    - `gamemoderun`
    - `mangohud`
    - wrappers customizados do perfil;
  - env:
    - base (`WINEPREFIX`, `PROTON_VERB`);
    - `PROTONPATH` quando aplicavel;
    - prime offload opcional;
    - variaveis customizadas com bloqueio de chaves protegidas.
- Execucao:
  - `wait()` no processo principal do jogo;
  - dry-run global por `LUTHIER_DRY_RUN=1`.
- Logs adicionais por etapa para depuracao humana/IA.

Proximo checkpoint planejado:
- Expor comandos Tauri reais (`#[tauri::command]`) no backend do App Luthier.
- Criar UI mínima do Criador para gerar e testar sem sair da janela.

### 2026-02-24 - Checkpoint 10
Escopo implementado:
- Camada de comando preparada no backend `src-tauri`:
  - `cmd_create_executable(...)`
  - `cmd_hash_executable(...)`
- Compatibilidade com Tauri via feature flag:
  - `tauri-commands` habilita `#[tauri::command]` sem acoplar build padrão.

Proximo checkpoint planejado:
- Criar bootstrap Tauri (`main.rs`) com `generate_handler!` e registro desses comandos.
- Iniciar UI mínima para fluxo de:
  - selecionar `.exe`
  - gerar payload
  - `Testar`
  - `Criar Executavel`.

### 2026-02-24 - Checkpoint 11
Escopo implementado:
- Bootstrap do backend Tauri criado:
  - `src-tauri/src/main.rs` com `tauri::Builder` e `generate_handler!`.
  - comandos registrados:
    - `cmd_create_executable`
    - `cmd_hash_executable`
- `tauri.conf.json` mínimo adicionado no `src-tauri`.
- Feature gate preservada:
  - build padrão sem runtime Tauri;
  - runtime real habilitado com `--features tauri-commands`.

Proximo checkpoint planejado:
- Iniciar frontend mínimo com fluxo:
  - selecionar `.exe`
  - editar config base
  - `Testar`
  - `Criar Executavel`.

### 2026-02-24 - Checkpoint 12
Escopo implementado:
- Frontend mínimo do App Luthier criado em `apps/luthier`:
  - stack: Vite + Solid;
  - abas iniciais:
    - Jogo
    - Runtime
    - Revisao e Gerar.
- Fluxos já conectados com backend:
  - `Calcular Hash` -> `cmd_hash_executable`
  - `Testar` -> `cmd_test_configuration`
  - `Criar Executavel` -> `cmd_create_executable`
- Backend `src-tauri` ganhou comando de teste:
  - valida payload;
  - roda doctor;
  - monta prefix plan;
  - retorna status e arquivos ausentes.

Proximo checkpoint planejado:
- Expandir UI para cobrir campos adicionais das abas do projeto.
- Integrar i18n (`pt-BR`, `en-US`) no frontend e mensagens do backend.

### 2026-02-24 - Checkpoint 13
Escopo implementado:
- i18n inicial da UI do Criador:
  - idiomas:
    - `pt-BR`
    - `en-US`
  - seletor de idioma no header;
  - persistencia da preferencia via `localStorage`.
- Textos principais internacionalizados:
  - titulos da tela;
  - abas;
  - labels/tooltips da UI mínima;
  - mensagens de status.

Proximo checkpoint planejado:
- Internacionalizar mensagens retornadas pelo backend (`src-tauri`).
- Expandir a UI para mais campos de configuracao por aba.

### 2026-02-24 - Checkpoint 14
Escopo implementado:
- Novo utilitario `luthier-cli` para testes via terminal:
  - `hash`
  - `test`
  - `create`
- Objetivo:
  - permitir validar fluxo de hash/test/geracao sem depender de frontend/UI Tauri.

Proximo checkpoint planejado:
- Internacionalizar mensagens de backend (`src-tauri`).
- Expandir a UI para mais campos e tabelas por aba.

### 2026-02-24 - Checkpoint 15
Escopo implementado:
- Hotfix de build validado com feedback de execução real:
  - parser de trailer corrigido para converter `json_len` com tipo explícito;
  - dependência `serde` adicionada no binário `orchestrator`.
- Resultado:
  - `cargo build --workspace` agora finaliza com sucesso.

Proximo checkpoint planejado:
- Internacionalizar respostas do backend (`src-tauri`) e mapear `error_code` para UI.
- Expandir UI para incluir mais configurações avançadas por aba.

### 2026-02-24 - Checkpoint 16
Escopo implementado:
- Revisao tecnica e hardening dos pontos criticos:
  - corrigidos erros de `clippy -D warnings` no workspace;
  - refatorada API de observabilidade para reduzir acoplamento de argumentos.
- Luthier Orchestrator (`--play`) reforcado com validacao defensiva de paths:
  - bloqueia path absoluto Linux/Windows e traversal (`..`) inclusive com `\`;
  - mesma regra aplicada em validacao de integridade e resolucao do exe.
- `--config` deixou de ser placeholder:
  - agora gerencia overrides opcionais por jogo para `mangohud`, `gamescope`, `gamemode`;
  - suporte a `--set-mangohud`, `--set-gamescope`, `--set-gamemode`;
  - overrides persistidos em `~/.local/share/Luthier/overrides/<exe_hash>.json`;
  - `--play` aplica automaticamente os overrides persistidos.
- Wrappers customizados:
  - `MandatoryOn` ausente/invalido agora bloqueia com erro explicito;
  - opcionais ausentes/invalidos sao ignorados sem derrubar launch.
- Prefix setup:
  - politica de `winetricks` respeita `MandatoryOff`/`OptionalOff` (nao instala por padrao).
- Doctor/discovery:
  - discovery de Proton expandido para `steamapps/common` alem de `compatibilitytools.d`;
  - selecao do Proton melhorada (prioriza candidato mais recente por metadata);
  - checagem de executabilidade para `wine`, `umu-run` e binarios descobertos no `PATH`.
- Alinhamento Tauri:
  - frontend ajustado para `@tauri-apps/api` v1;
  - `tauri.conf.json` alinhado ao schema v1 para compatibilidade com backend Rust atual.

Validacao do checkpoint:
- `cargo fmt --all`
- `cargo build --workspace`
- `cargo test --workspace --all-targets`
- `cargo clippy --workspace --all-targets -- -D warnings`

### 2026-02-24 - Checkpoint 17
Escopo implementado:
- Integracao de `folder_mounts` no fluxo real do Luthier Orchestrator (`--play`), antes do pre-launch:
  - validacao estrita de origem relativa dentro da pasta do jogo;
  - validacao estrita de destino Windows (`X:\...`, sem `%VAR%`, sem UNC e sem traversal `..`);
  - suporte a `create_source_if_missing`;
  - montagem por symlink com comportamento idempotente (`mounted`/`unchanged`);
  - deteccao de destinos duplicados no payload.
- `--play` agora inclui o resultado de montagens no JSON final (`folder_mounts`).
- Falha em montagem interrompe launch com erro acionavel e contexto no JSON.
- Observabilidade:
  - novo evento NDJSON `GO-MT-020` com contagem de montagens (`mounted`, `unchanged`, `planned`).
- Testes:
  - cobertura de parsing de destino Windows para `C:` e drives alternativos;
  - rejeicao de `%ENV%`, UNC e traversal.

Validacao do checkpoint:
- `cargo fmt --all`
- `cargo test -p luthier-orchestrator -- --nocapture`
- `cargo build --workspace`
- `cargo clippy -p luthier-orchestrator --all-targets -- -D warnings`

### 2026-02-24 - Checkpoint 19
Escopo implementado:
- Hardening de validacao no `luthier-core` (antes de gerar o binario):
  - paths relativos agora sao validados de forma lexical e cross-platform:
    - bloqueia vazio;
    - bloqueia absolutos Linux (`/`) e Windows (`C:\...`);
    - bloqueia traversal com `/..` e `\..`.
  - validacao de `folder_mounts.target_windows_path` no App Luthier:
    - exige formato `X:\...`;
    - bloqueia `%ENV%`, UNC (`\\server\share`) e traversal;
    - normaliza e detecta destinos duplicados (case-insensitive).
- `to_relative_inside_game_root` agora retorna path normalizado em formato unix-like.
- Novas variantes de erro em `LuthierError` para falhas de mount target e path invalido.
- Testes adicionados para:
  - absoluto Windows em path relativo;
  - traversal com backslash;
  - mount target invalido;
  - mount target duplicado;
  - normalizacao de path com backslash.

Validacao do checkpoint:
- `cargo fmt --all`
- `cargo test -p luthier-core -- --nocapture`
- `cargo build --workspace`
- `cargo clippy -p luthier-core --all-targets -- -D warnings`

### 2026-02-24 - Checkpoint 18
Escopo implementado:
- Lock de instancia por jogo (`exe_hash`) no Luthier Orchestrator:
  - lock file em `~/.local/share/Luthier/locks/<exe_hash>.lock`;
  - exclusao mutua por `create_new(true)` para evitar duas execucoes concorrentes;
  - metadata no lock (`pid`, `created_at`);
  - reclaim automatico de lock stale quando PID nao existe mais (`/proc/<pid>` ausente).
- `--play` agora tenta adquirir lock antes do pipeline:
  - se lock indisponivel, retorna `BLOCKER` no JSON e aborta launch;
  - lock e liberado automaticamente ao encerrar fluxo (guard com `Drop`).
- Observabilidade:
  - novo evento NDJSON `GO-LK-010` ao adquirir lock com caminho do lock.
- Testes:
  - garante exclusividade (segunda instancia falha enquanto primeira esta ativa);
  - garante reaproveitamento de lock stale.

Validacao do checkpoint:
- `cargo fmt --all`
- `cargo test -p luthier-orchestrator -- --nocapture`
- `cargo build --workspace`
- `cargo clippy -p luthier-orchestrator --all-targets -- -D warnings`

### 2026-02-24 - Checkpoint 20
Escopo implementado:
- App Luthier (frontend Solid) recebeu refatoracao visual completa com componentes reutilizaveis:
  - `TextInputField`, `TextAreaField`, `SelectField`, `ToggleField`;
  - `StringListField` (listas editaveis);
  - `KeyValueListField` (chave/valor);
  - `FieldShell` padronizando label + tooltip `?`.
- UI estruturada nas 8 abas planejadas:
  - `Jogo`
  - `Runtime`
  - `Performance e Compatibilidade`
  - `Prefixo e Dependencias`
  - `Winecfg`
  - `Wrappers e Ambiente`
  - `Scripts`
  - `Revisao e Gerar`
- Todas as opcoes principais de configuracao do payload estao visiveis e editaveis na UI (MVP visual), incluindo:
  - estados de feature (`MandatoryOn`, `MandatoryOff`, `OptionalOn`, `OptionalOff`);
  - runtime primario/fallback;
  - dependencias extras;
  - winetricks, registry keys, folder mounts;
  - opcoes de winecfg (dll overrides, virtual desktop, drives, audio);
  - wrappers customizados, variaveis de ambiente e scripts.
- Ajuste de layout/CSS para suportar:
  - listas e tabelas editaveis;
  - cards de resumo;
  - responsividade desktop/mobile.
- Limpeza tecnica:
  - componente legado `components/Field.tsx` removido (nao utilizado).

Observacoes desta etapa:
- `Import .reg` e `Extrair icone` estao prontos visualmente, mas ainda nao conectados ao backend (proxima etapa funcional).

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise x node@lts -- npm run build` (frontend)
- `cargo build --workspace`

### 2026-02-24 - Checkpoint 21
Escopo implementado:
- Correcoes de UX no App Luthier (frontend):
  - campo de executavel com `file picker` real;
  - `Import .reg` com `file picker`;
  - `folder_mounts.source_relative_path` com `folder picker` (com validacao para pasta dentro de `game_root`);
  - `Luthier Orchestrator base` tornou-se fixo/read-only (nao editavel pela UI).
- Runtime/fallback:
  - fallback reorganizado para fluxo de adicionar/remover e mover ordem (`Subir`/`Descer`).
- Toggles:
  - checkboxes substituidos por botoes `Sim`/`Nao` com feedback visual de cor.
- Gamescope (inspirado em Heroic):
  - opcoes avancadas visiveis apenas quando gamescope esta ativo;
  - campos adicionados: resolucao de jogo (w/h), resolucao de saida (w/h), metodo de upscale, tipo de janela, limitador de FPS (foco/sem foco), force grab cursor e opcoes adicionais.
- Winetricks:
  - politica manual removida da UI; ativacao agora e automatica quando houver verbos;
  - lista de verbos via catalogo (modelo Heroic), sem entrada livre como fluxo principal.
- Backend local App Luthier:
  - novo comando `cmd_winetricks_available`;
  - tenta ler verbos via `winetricks dlls list` + `fonts list`;
  - fallback para lista curada quando `winetricks` nao estiver disponivel.
- Correcao de edicao:
  - tabela de dependencias extras corrigida (nao perde input por caractere);
  - adicionador de variaveis de ambiente corrigido (fluxo por linha de rascunho).
- Winecfg:
  - exibicao de defaults de drives (`C:` interno fixo + `Z:` padrao compatibilidade) com botao para restaurar padrao.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise x node@lts -- npm run build` (frontend)
- `cargo test -p luthier-backend -- --nocapture`
- `cargo build --workspace`

### 2026-02-24 - Checkpoint 22
Escopo implementado:
- Pickers com fallback para modo browser (sem runtime Tauri):
  - `pickFile` e `pickFolder` tentam dialog nativo Tauri;
  - se Tauri nao estiver disponivel (ex.: `npm run dev` web), usam fallback via `<input type=\"file\">`.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise x node@lts -- npm run build` (frontend)
- `cargo test -p luthier-backend -- --nocapture`

### 2026-02-24 - Checkpoint 23
Escopo implementado:
- Pipeline de build desktop do App Luthier consolidado:
  - `src-tauri/build.rs` adicionado com `tauri_build::build()`;
  - `tauri-build` em `build-dependencies`;
  - `tauri.conf.json` com `beforeDevCommand`/`beforeBuildCommand` e bundle ativo.
- Comandos Tauri reorganizados para evitar conflito de macro em release:
  - wrappers `#[tauri::command]` movidos para `src-tauri/src/main.rs`;
  - `src-tauri/src/lib.rs` mantido como camada pura de logica.
- Preparacao automatica de compatibilidade Linux para Tauri v1 em distros com WebKit 4.1:
  - script `apps/luthier/scripts/prepare-linux-compat.sh`;
  - gera `pkgconfig/*-4.0.pc` apontando para libs 4.1;
  - gera `libshims/libwebkit2gtk-4.0.so` e `libshims/libjavascriptcoregtk-4.0.so`.
- Scripts NPM atualizados:
  - `tauri:dev` e `tauri:build` executam o script de compatibilidade antes do build;
  - `tauri:build` usa `-b none` para gerar binario nativo sem depender do bundler AppImage;
  - `tauri:bundle` mantido separado para empacotamento completo.
- Icone minimo RGBA adicionado em `src-tauri/icons/icon.png` para satisfazer o `generate_context`.
- Observacao de ambiente (Arch/CachyOS): bundling AppImage falha por limitacao do `strip` do `linuxdeploy` com binarios RELR; build de binario nativo funciona.

Resultado operacional:
- Binario desktop do Luthier gerado em:
  - `target/release/luthier`

Validacao do checkpoint:
- `npm run tauri:build` (com `mise`, gerando binario release)
- `cargo test -p luthier-backend -- --nocapture`

### 2026-02-24 - Checkpoint 24
Escopo implementado:
- Refatoracao completa de UX visual do App Luthier (frontend):
  - novo tema claro com contraste consistente e estilos globais para `input/select/textarea`;
  - componentes e cards com hierarquia visual mais limpa e legivel;
  - responsividade revisada para desktop/mobile.
- Controles binarios atualizados:
  - `ToggleField` passou de dois botoes (`Sim/Não`) para toggle unico clicavel, com estado textual.
- Fluxo de pasta do jogo simplificado:
  - pasta raiz agora e derivada automaticamente do caminho do `.exe`;
  - campo da pasta raiz ficou somente leitura (sem picker/manual upload de pasta).
- Winetricks com UX de busca progressiva (estilo autocomplete):
  - nao renderiza lista completa para evitar travamento;
  - busca so exibe resultados com 2+ caracteres;
  - resultados limitados (top 24), com adicao por clique ou Enter.
- Ajustes de comportamento:
  - `relative_exe_path` passa a ser atualizado automaticamente ao mudar o caminho do executavel.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise x node@lts -- npm run build` (frontend)
- `cargo test -p luthier-backend -- --nocapture`

### 2026-02-24 - Checkpoint 25
Escopo implementado:
- Redesign estrutural completo da interface do Luthier:
  - novo layout com barra lateral de abas e area de edicao principal;
  - header simplificado com foco no fluxo de configuracao (sem depender de status no topo).
- UX de controles binarios refeita:
  - `ToggleField` agora usa controle compacto ao lado do titulo (sem botao gigante em largura total).
- Feedback de status/erro melhorado:
  - mensagens agora aparecem em `toast` fixo no canto inferior direito, sempre visivel mesmo com scroll.
- Sistema visual revisado do zero:
  - novo tema com contraste mais forte e legibilidade consistente;
  - estilos globais para todos os campos (`input/select/textarea`) para evitar casos de texto invisivel;
  - ajustes responsivos para sidebar, tabelas e grids em telas menores.
- Mantidas as regras funcionais da etapa anterior:
  - pasta raiz derivada automaticamente do `.exe`;
  - busca progressiva de Winetricks com limite de resultados e adicao por Enter/click.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise x node@lts -- npm run build` (frontend)
- `cargo test -p luthier-backend -- --nocapture`

### 2026-02-24 - Checkpoint 26
Escopo implementado:
- Reescrita do frontend para base shadcn com separacao de responsabilidades:
  - `App.tsx` virou entrypoint minimo;
  - nova camada `features/luthier/useLuthierController.ts` concentra estado, efeitos, comandos Tauri e regras de negocio da UI;
  - `features/luthier/LuthierPage.tsx` ficou focada em renderizacao.
- Padronizacao visual com componentes shadcn/primitivos:
  - criados `ui/input.tsx`, `ui/textarea.tsx`, `ui/select.tsx`, `ui/badge.tsx`;
  - `FormControls.tsx` migrado para `Input/Select/Textarea/Switch/Button` com layout consistente.
- Interface revisada com comportamento preservado:
  - botoes/inputs/selects da tela principal foram convertidos para componentes padronizados;
  - status continua visivel com toast no rodape;
  - fluxo de pickers e fallbacks (exe, .reg, folder_mounts) mantido.
- Organizacao e higiene do frontend:
  - removido `src/styles.css` nao utilizado;
  - mantido `src/styles/app.css` como fonte unica de tema/estilo;
  - tema forca `color-scheme: light` para evitar campos com contraste ruim.
- Ajuste de dependencias JS:
  - removido pacote `cva` legado/invalido;
  - removido `@tailwindcss/postcss` nao utilizado;
  - lockfile atualizado via `npm install`.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 63
Escopo implementado:
- Revisao de cores/contraste (Luthier UI):
  - `Alert` variante `warning` corrigida para contraste adequado em tema claro/escuro (antes usava texto claro demais no light theme);
  - `SwitchChoiceCard` (usado em varios itens, incluindo `Melhorias`) alinhado visualmente ao padrao dos outros cards de toggle (`accent` quando selecionado, `background/accent` quando inativo/hover);
  - botoes `.btn-test` e `.btn-danger` migrados de cores hardcoded (`sky/rose`) para semantica baseada em tokens (`primary`/`destructive`) para manter coerencia com o tema atual do shadcn.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 62
Escopo implementado:
- Tema visual do Luthier alinhado aos tokens extraidos do site do shadcn/ui:
  - variaveis CSS (`:root` e `.dark`) atualizadas com os valores enviados (light/dark);
  - tons de cinza/contraste do app passam a seguir a paleta real do site (via tokens).
- Tailwind config ajustado:
  - cores passaram a ser resolvidas com `lab(var(--token))` em vez de `oklch(...)`, para compatibilidade com os tokens extraidos via `getComputedStyle`.
- Fundo do app:
  - removido gradiente radial do `body`;
  - fundo agora e solido (`--background`), como no site.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 61
Escopo implementado:
- Drawer mobile da sidebar:
  - removido botao `X` (overlay continua fechando o menu).
- Layout do bloco principal:
  - `Card`/`CardContent` ajustados para layout em coluna (`flex`) com altura minima de viewport;
  - area de conteudo das abas encapsulada em container `flex-1`.
- Navegacao entre abas (`Retornar` / `Avançar`):
  - permanece no rodape visual do bloco principal (alinhamento consistente mesmo em abas com pouco conteudo) via `mt-auto`.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 60
Escopo implementado:
- Refinos de layout/navegacao no bloco principal:
  - botoes `Retornar`/`Avançar` movidos do topo para o rodape do bloco principal de conteudo;
  - `Retornar` fica oculto na primeira aba;
  - `Avançar` fica oculto na ultima aba;
  - ambos usam a mesma altura visual (`h-10`).
- Header interno da etapa (topo do bloco principal):
  - titulo da aba atual + subtitulo `Etapa x/N` centralizados;
  - botao de menu mobile reposicionado para nao colidir visualmente com o titulo.
- Sidebar mobile (drawer):
  - adicionado botao `X` para fechar o drawer, alem do clique no overlay.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 59
Escopo implementado:
- Layout geral do Luthier (UI):
  - header superior removido;
  - tela agora usa apenas `sidebar` + bloco principal de conteudo.
- Sidebar:
  - manteve nome do app no topo e abas de navegacao;
  - footer ganhou itens para alternar idioma e tema (via botoes com icones);
  - footer ganhou icones de redes/apoio (GitHub, Patreon, Ko-fi) como placeholders sem links.
- Responsividade (mobile):
  - sidebar desktop fica oculta em telas pequenas;
  - adicionado menu hamburguer para abrir sidebar em modo drawer/offcanvas com overlay;
  - ao selecionar uma aba no drawer mobile, ele fecha automaticamente.
- Bloco principal de conteudo:
  - adicionada barra superior de navegacao da etapa com:
    - botao de menu (mobile),
    - nome da aba atual + contador de etapa,
    - botoes `Retornar` e `Avançar` para navegar entre abas.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 58
Escopo implementado:
- Aba `Jogo`:
  - `Prefix path final` reposicionado para ficar logo abaixo de `Hash SHA-256`.
- Aba `Revisão e Gerar`:
  - item `Luthier Orchestrator base` removido da UI;
  - item `Saída do executável` ocultado da UI;
  - `Resumo do payload` ajustado para mostrar os cards de contagem no rodape do item (`FieldShell.footer`);
  - botoes `Testar` e `Criar executável` movidos para abaixo do `Preview do Payload JSON`.
- Fluxo interno (controller):
  - `outputPath` passou a ser derivado automaticamente do executável principal selecionado (mesmo diretorio e nome-base, sem extensão de launcher `.exe/.bat/.cmd/.com`), para permitir ocultar o campo manual com seguranca.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 57
Escopo implementado:
- Reorganizacao de abas (Luthier UI):
  - aba `Performance e Compatibilidade` renomeada para `Melhorias`;
  - aba `Prefixo e Dependências` renomeada para `Dependências`.
- Aba `Jogo`:
  - `Prefix path final` movido para a aba `Jogo`;
  - `Pastas montadas (folder_mounts)` movido para a aba `Jogo` (tabela + dialogs mantidos).
- Aba `Dependências`:
  - agora concentra `Winetricks`, `Chaves de registro` e `Dependências extras do sistema`;
  - `Prefix path final` e `Pastas montadas` removidos desta aba.
- Aba `Execução e Ambiente`:
  - alerts `Chaves protegidas` e `Validação básica` deixaram de ficar dentro de `FieldShell`;
  - agora são renderizados como alerts independentes no fluxo da aba.
- Infra da UI:
  - adicionados helpers locais para breadcrumb/seleção do mini navegador de pastas (`mountSourceBrowserSegments`, `mountSourceBrowserCurrentRelative`) para suportar `folder_mounts` na aba `Jogo`.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 56
Escopo implementado:
- Aba `Wrappers e Ambiente` renomeada para `Execução e Ambiente` e consolidada:
  - conteudo de `Scripts` foi movido para a mesma aba;
  - aba `Scripts` removida da navegacao lateral e da ordem de tabs do Luthier (compatibilidade visual mantida).
- `Wrapper commands`:
  - lista substituida por tabela com cabecalho (`Ativado`, `Obrigatório`, `Executável`, `Argumentos`);
  - dialog de adicao agora usa cards clicaveis para politica (`Ativado` / `Obrigatório`) em duas colunas;
  - `FeatureState` continua sendo persistido no backend via composicao dos dois cards.
- `Variáveis de ambiente`:
  - `KeyValueListField` expandido para suportar tabela com cabecalho;
  - estado vazio agora mostra divisor + mensagem (`Nenhuma variável de ambiente adicionada.`).
- `Chaves protegidas`:
  - item informativo convertido para `Alert` (warning), explicando keys reservadas pelo runtime.
- `Scripts` (`pre-launch` e `post-launch`):
  - campos agora aparecem como `FieldShell` com `Textarea` no rodape (largura total);
  - melhor aderencia ao padrao visual dos demais itens da UI.
- `Validação básica`:
  - item convertido para `Alert` (warning) com regras do MVP (bash local, sem envio para API comunitaria).

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 35
Escopo implementado:
- Aba `Runtime` reestruturada para um fluxo mais simples:
  - `Preferência geral de runtime` agora usa seletor segmentado `Auto | Proton | Wine` (estilo tabs/shadcn).
  - `Runtime primário` removido da UI (mantido no schema para compatibilidade do payload).
  - `Ordem de fallback` removida da UI por enquanto (mantida no schema para futura fase).
- Configuração de versão consolidada em um único item:
  - label e descrição mudam dinamicamente conforme a preferência (`Auto`, `Proton`, `Wine`);
  - campo de versão + select `Versão obrigatória` + select `Auto update` ficam no mesmo item.
- `Runtime estrito` deixou de ser toggle separado e passou a ser configurado por select (`Versão obrigatória`) dentro do item de versão.
- `Auto update do runner` deixou de ser item separado e passou a select dentro do item de versão.

Observacao de arquitetura:
- A simplificação foi aplicada apenas na camada de UI. Os campos de schema (`requirements.runtime.primary` e `fallback_order`) continuam existindo para preservar compatibilidade e permitir retorno posterior sem migração de payload.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 36
Escopo implementado:
- UX do item `Versão de runtime` refinada na aba `Runtime`:
  - `Versão obrigatória` e `Auto update` trocaram de `select` para `switch`;
  - layout consolidado em painel lateral de toggles, reduzindo aperto visual no item combinado.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 37
Escopo implementado:
- Refinamento visual do tema dark para reduzir "preto puro" nos controles:
  - `Button variant="outline"` passou a usar fundo suavizado no dark (`dark:bg-muted/30`, hover `dark:bg-muted/50`);
  - `Input`, `Select` e `Textarea` passaram a usar fundo suavizado no dark (`dark:bg-muted/20`).
- Objetivo:
  - manter a paleta/tokens do tema shadcn;
  - reduzir contraste excessivo entre cards e controles secundarios, melhorando consistencia visual.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 38
Escopo implementado:
- Regras de campos derivados / somente leitura:
  - `Hash SHA-256` passou a ser somente leitura (preenchido pelo botao `Calcular hash`);
  - `Prefix path final` ja permanece somente leitura;
  - `Pasta raiz do jogo` (exibicao relativa) permanece somente leitura.
- Botoes dependentes de contexto agora desabilitam preventivamente:
  - `Calcular hash` exige runtime Tauri local + caminho absoluto do executavel;
  - `Escolher outra` (pasta raiz do jogo) exige executavel preenchido;
  - `Adicionar montagem` exige `game root` definido;
  - `Navegar pastas` (mini navegador de mounts) exige Tauri local + `game root` absoluto;
  - `Adicionar de arquivo (.reg)` exige runtime Tauri local.
- `Arquivos obrigatorios (integrity_files)`:
  - botao de picker interno (`Escolher arquivo na pasta do jogo`) agora pode ser desabilitado independentemente do botao `Adicionar` (suporte novo em `StringListField`).
- `Gamescope > Resolucao da tela`:
  - campos manuais de largura/altura ficam desabilitados quando `Obter resolucao do monitor` esta ativo.

Observacao:
- Estados condicionais ja existentes (ex.: `HDR` oculto quando Wine-Wayland desativado; opcoes avancadas de Gamescope ocultas quando Gamescope desligado) foram mantidos.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 39
Escopo implementado:
- Revisao de textos (copy) no Luthier com foco em linguagem de usuario final:
  - removidos/ocultados termos internos de schema em labels visiveis (ex.: `integrity_files`, `folder_mounts`, `custom_vars`, `payload`);
  - textos da aba `Execucao e Ambiente` e `Revisao e Gerar` ajustados para nomes mais claros (`Comandos de wrapper`, `Resumo da configuracao`, `Resultado da ultima acao`, etc.);
  - textos de ajuda revisados para explicar impacto ao usuario em vez de nomenclatura interna.
- Internacionalizacao dos componentes de formulario (`FormControls`):
  - criado `FormControlsI18nProvider` para evitar strings hardcoded em componentes reutilizaveis;
  - labels/padroes de cards e dialogs (Ativado, Obrigatorio, Cancelar, Confirmar, Acoes, etc.) agora recebem traducao do `LuthierPage`.
- Dicionario `i18n.ts` revisado:
  - melhorias de copy (pt-BR/en-US), acentos e consistencia;
  - `statusReady` alinhado com o texto usado para suprimir toast de "pronto/ready".

Observacao de arquitetura (i18n):
- O projeto JA usa i18n (arquivo `src/i18n.ts`) + `tx(pt,en)` inline.
- Ainda existe bastante texto inline com `tx(...)` dentro do `LuthierPage`, o que funciona bem para 2 idiomas, mas nao eh o ideal para escalar.
- Para adicionar varios idiomas no futuro, o proximo passo recomendado eh migrar textos inline para chaves tipadas em dicionario (mantendo `tx` apenas para prototipagem).

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 37
Escopo implementado:
- Itens de listas do Luthier migrados de "cards/linhas soltas" para tabelas simples com cabecalho (melhor legibilidade de colunas):
  - `Argumentos de launch`
  - `Arquivos obrigatorios (integrity_files)`
  - `Dependencias extras do sistema`
  - `Chaves de registro`
  - `Pastas montadas (folder_mounts)`
- Adicionado componente UI `Table` (estilo shadcn/solid) em `components/ui/table.tsx`.
- `StringListField` agora suporta modo tabela opcional via `tableValueHeader`, preservando comportamento anterior nos outros usos.

Regra de UX:
- Sempre que a lista tiver mais de um atributo/coluna relevante, preferir tabela com cabecalho explicito.
- Mensagens de estado vazio foram mantidas (ex.: "Nenhuma chave adicionada.").

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 38
Escopo implementado:
- Reestruturacao da aba `winecfg` (Luthier):
  - `Substituicao de DLL` agora usa tabela com cabecalho;
  - coluna `Modo` (builtin/native/etc.) passou a ser editavel diretamente na tabela;
  - adicionada configuracao de `Versao do Windows (winecfg)` como override opcional (select com "Padrao do runtime").
- Novo layout por acordeao na aba `winecfg` (inspirado nas abas do winecfg original):
  - `Graficos`
  - `Integracao com area de trabalho`
  - `Unidades`
  - `Audio`
- `Graficos`:
  - cards/politicas para captura de mouse, decoracao de janelas, controle de janelas e desktop virtual;
  - quando desktop virtual esta ativo, aparecem campos `largura x altura`;
  - adicionado slider de DPI (`96` a `480 ppp`) com opcao `Usar padrao`.
- `Integracao com area de trabalho`:
  - politica geral de integracao com desktop;
  - politica de MIME / associacoes de arquivo e protocolo;
  - tabela de `Pastas especiais` com dialog para adicionar `tipo + atalho + caminho Linux`.
- `Unidades`:
  - tabela com cabecalho (letra, caminho Linux, tipo, rotulo, serial);
  - dialog de adicao com letra restrita a valores ainda nao utilizados;
  - metadados de tipo/rotulo/serial incluidos no payload (como overrides adicionais).
- `Audio`:
  - bloco no acordeao com seletor de backend de audio (`pipewire`, `pulseaudio`, `alsa` ou padrao do runtime).

- Schema expandido (TS + Rust / serde compativel):
  - `winecfg.windows_version`
  - `winecfg.screen_dpi`
  - `winecfg.mime_associations`
  - `winecfg.desktop_folders[]`
  - metadados opcionais em `winecfg.drives[]` (`host_path`, `drive_type`, `label`, `serial`)
  - campos novos no Rust usam `serde(default)` para manter compatibilidade com payloads antigos.

- Luthier Orchestrator CLI:
  - adicionado parametro `--winecfg`;
  - fluxo executa `Doctor`, setup de prefixo (se necessario) e abre `winecfg` no runtime selecionado;
  - gera saida JSON com plano/comando/resultados (seguindo padrao dos outros comandos).

Observacao de implementacao:
- Varias opcoes de `winecfg` ainda sao tratadas como payload/UI e schema (MVP visual/contrato). Aplicacao detalhada dessas chaves no setup real do prefixo permanece fase seguinte.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)
- `/home/rafael/.cargo/bin/cargo build --workspace`

### 2026-02-24 - Checkpoint 40
Escopo implementado:
- Migracao estrutural de i18n no Luthier (sem `tx(...)` inline na tela principal):
  - `LuthierPage.tsx` e `useLuthierController.ts` agora usam chaves centralizadas (`ct(...)`) em vez de pares inline `tx('pt','en')`;
  - casos dinamicos (contagem/erro/interpolacao) migrados para `ctf(...)` com placeholders (`{count}`, `{error}`, etc.).
- Novo dicionario dedicado do Luthier:
  - arquivo `apps/luthier/src/features/luthier/luthier-copy.ts` com `creatorMessages`, `creatorTranslate` e `creatorFormat`;
  - centraliza textos de interface da feature Luthier em um unico lugar.
- Internacionalizacao pronta para escalar:
  - para adicionar novo idioma do Luthier, basta adicionar um novo bloco no dicionario da feature (e no `Locale` global), sem alterar componentes/tela;
  - `FormControls` continua usando provider de i18n local (`FormControlsI18nProvider`) alimentado por chaves centralizadas.

Observacao de arquitetura:
- `i18n.ts` permanece para textos globais/status existentes.
- `luthier-copy.ts` concentra a copy extensa da feature Luthier para reduzir ruido e facilitar manutencao.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 41
Escopo implementado:
- Super refatoracao estrutural da tela principal do Luthier (`LuthierPage`), sem mudar comportamento:
  - extracao dos helpers/componentes locais para `apps/luthier/src/features/luthier/luthier-page-shared.tsx`;
  - extracao das abas em arquivos dedicados dentro de `apps/luthier/src/features/luthier/sections/`:
    - `game-tab.tsx`
    - `runtime-tab.tsx`
    - `performance-tab.tsx`
    - `dependencies-tab.tsx`
    - `winecfg-tab.tsx`
    - `launch-environment-tab.tsx`
    - `review-tab.tsx`
- `LuthierPage.tsx` ficou focado em:
  - composicao de layout geral (sidebar + card principal);
  - estados locais/dialogos/sinais;
  - handlers de alto nivel;
  - montagem do `sectionView` compartilhado para as abas.
- Reducao de complexidade do arquivo principal:
  - `LuthierPage.tsx` caiu de ~3500 linhas para ~760 linhas (aprox.).
- Limpeza de imports residuais no `LuthierPage` apos extracao, melhorando legibilidade humana.

Observacao de arquitetura:
- As abas recebem um objeto `view` compartilhado (`sectionView`) para preservar comportamento sem reescrever toda a logica em hooks menores nesta etapa.
- Proxima rodada de refino (futuro): tipar mais fortemente `sectionView` e quebrar `winecfg-tab.tsx` (ainda o maior arquivo da UI).

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 36
Escopo implementado:
- Padronizacao visual de botoes secundarios no Luthier UI:
  - botoes de acoes auxiliares (`Selecionar executavel`, `Escolher outra`, `Calcular hash`, `Copiar`, `Extrair icone`, `Atualizar catalogo winetricks`) passaram a usar `Button variant="outline"` em vez de classe custom `btn-secondary`;
  - reduz discrepancia visual entre botoes pretos/cinza no tema escuro e alinha com o padrao shadcn.
- Padronizacao dos botoes "Adicionar ..." em listas/dialogs:
  - `StringListField` e `KeyValueListField` passaram a abrir dialog com `Button` explicito (`variant="outline"`) em vez de `DialogTrigger as={Button}`;
  - evita perda de estilo/variant em alguns cenarios de renderizacao.
- Campos read-only:
  - classe `.readonly` ajustada para o mesmo tom dos demais campos somente leitura (`bg-muted/50`), reduzindo inconsistencias entre inputs readonly.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 55
Escopo implementado:
- Feedback global da UI do Luthier migrado de banner fixo para `Sonner`:
  - mensagens de status agora disparam `toast.info`, `toast.success` e `toast.error`;
  - `Toaster` posicionado no canto inferior direito com `richColors` e botao de fechar;
  - mensagens `Pronto./Ready.` sao ignoradas para reduzir ruido.
- UX do item `Winetricks` (aba `Prefix`):
  - erro de carregamento do catalogo substituido por componente `Alert` (`destructive`);
  - indicador de carregamento com `Spinner` visivel no proprio item enquanto o catalogo carrega;
  - botao `Atualizar catálogo` continua como retry manual.
- Performance percebida ao entrar na aba `Prefix`:
  - carregamento automatico do catalogo Winetricks passou a ser disparado com pequeno atraso (`setTimeout`) para permitir renderizacao inicial da aba e exibicao do spinner;
  - reduz a sensacao de travada ao trocar de aba.
- Infra:
  - novo componente reutilizavel `Spinner` (`components/ui/spinner.tsx`);
  - removido CSS morto do antigo banner `.status-toast`.
- Dependencias frontend:
  - adicionada dependencia `solid-sonner`.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 39
Escopo implementado:
- Ajuste de comportamento do acordeao na aba `winecfg`:
  - todas as secoes iniciam fechadas por padrao;
  - apenas uma secao pode ficar aberta por vez (acordeao controlado);
  - ao abrir uma secao, a anteriormente aberta eh fechada automaticamente;
  - clicar na secao aberta novamente fecha (volta para "nenhuma aberta").

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 40
Escopo implementado:
- Itens de politica do `winecfg` (os que antes tinham apenas `Ativado` + `Obrigatorio`) agora usam 3 cards:
  - `Padrao do Wine`
  - `Ativado`
  - `Obrigatorio`
- Regras de UX:
  - `Padrao do Wine = ligado` -> card `Ativado` fica desabilitado (nao editavel);
  - `Obrigatorio` continua independente e preserva o papel de expor/bloquear edicao futura no launcher/config do Luthier Orchestrator;
  - somente itens da aba `winecfg` usam esse comportamento (nao afeta `FeatureStateField` generico).
- Schema expandido para suportar isso explicitamente:
  - novo tipo `WinecfgFeaturePolicy` (`state` + `use_wine_default`) no frontend e no Rust;
  - desserializacao Rust compativel com payload antigo (aceita `FeatureState` legado e converte para `use_wine_default = false`).

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)
- `/home/rafael/.cargo/bin/cargo build --workspace`

### 2026-02-24 - Checkpoint 41
Escopo implementado:
- Adicionado componente UI `Alert` (estilo shadcn, Solid) para mensagens de aviso/risco/contexto.
- Aplicados alertas na aba `winecfg` para orientar o usuario:
  - alerta geral da aba (configuracoes sao overrides adicionais ao padrao do prefixo/Wine);
  - `Graficos`: reforca que sao ajustes incrementais, nao recriacao de prefixo;
  - `Integracao com area de trabalho`: alerta sobre impacto em associacoes MIME/protocolo e integracao de desktop;
  - `Unidades`: alerta sobre cuidado com drives extras e preferencia por caminhos Linux genericos;
  - `Audio`: alerta para alterar backend apenas quando necessario (portabilidade).

Regra de UX:
- Sempre que houver comportamento com risco de impacto no host/compatibilidade, incluir `Alert` explicito no fluxo.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 37
Escopo implementado:
- Layout do item `Versão de runtime` reorganizado:
  - campo de versão foi movido para a coluna esquerda, logo abaixo da descrição do item;
  - coluna direita ficou dedicada ao painel com os switches (`Versão obrigatória` e `Auto update`), melhorando uso de espaço.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 38
Escopo implementado:
- Refino visual no item `Versão de runtime`:
  - voltou para a divisão padrão `meio a meio` (coluna esquerda e direita equilibradas);
  - `Versão obrigatória` e `Auto update` agora aparecem lado a lado na coluna direita;
  - removido o painel/quadrado agrupador da coluna direita para visual mais leve.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 39
Escopo implementado:
- Ajuste fino no item `Versão de runtime`:
  - restaurado o fundo/cartão individual em cada toggle (`Versão obrigatória` e `Auto update`);
  - mantido sem contêiner agrupando os dois toggles;
  - coluna da direita alinhada ao rodapé do item para acompanhar a altura do campo de versão na coluna esquerda.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 40
Escopo implementado:
- Refino visual dos toggles no item `Versão de runtime`:
  - removidos os textos secundários `Sim/Não` abaixo de `Versão obrigatória` e `Auto update`;
  - mantidos apenas os títulos + switch, reduzindo ruído visual.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 41
Escopo implementado:
- `ESYNC` e `FSYNC` consolidados em um unico item na aba `Runtime`:
  - dois cards lado a lado (esquerda/direita), no mesmo estilo visual dos toggles do item de versao de runtime;
  - cada card mostra apenas titulo + descricao + switch (sem texto `Ativado/Desativado`).

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 42
Escopo implementado:
- Novo padrao reutilizavel de toggle em `card clicavel + switch` aplicado na aba `Runtime`:
  - clicar no card inteiro alterna o switch;
  - estilo visual destaca o card quando ativo.
- Item `Versao de runtime` reestruturado:
  - topo do item volta ao padrao esquerda/direita (`titulo+descricao` na esquerda, campo de versao na direita);
  - `Versao obrigatoria` e `Auto update` foram movidos para o rodape do item;
  - ambos agora usam o novo padrao de card clicavel e receberam descricoes curtas.
- `ESYNC` e `FSYNC` tambem foram migrados para o mesmo padrao de card clicavel.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 43
Escopo implementado:
- Componente global `Switch` ajustado:
  - corrigido deslocamento da bolinha (`thumb`) para atingir corretamente o fim do trilho quando ativado.
- Novo `FeatureStateField` (UI do App Luthier):
  - substitui selects de `FeatureState` por dois cards clicaveis (`Ativado` e `Obrigatorio`) no lado direito do item;
  - cada card alterna um bit da semantica (`enabled` e `mandatory`) e preserva o outro;
  - mapeamento bidirecional mantido para o enum de payload:
    - `MandatoryOn`, `MandatoryOff`, `OptionalOn`, `OptionalOff`.
- Aplicado aos itens de `FeatureState` nas abas (Runtime, Performance/Compatibilidade e Winecfg) que usavam `SelectField<FeatureState>`.

Observacao de backend:
- Nao houve mudanca de schema/payload. A UI apenas passou a editar os mesmos 4 estados por meio de dois toggles (`Ativado` + `Obrigatorio`), preservando a logica de execucao do Luthier Orchestrator.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 44
Escopo implementado:
- Item `Dependencias extras do sistema` (aba Runtime) refeito para o padrao de listas com dialog:
  - botao `Adicionar dependencia` abre dialog;
  - dialog coleta: nome, comando no terminal, variaveis de ambiente (csv) e paths padrao (csv);
  - dependencias adicionadas aparecem no rodape do item como linhas resumidas, com botao de excluir (igual aos outros itens de lista).
- Removido da UI desse item o controle de `FeatureState` (Ativado/Obrigatorio), conforme regra de negocio atual.

Compatibilidade de payload:
- O schema foi preservado; ao adicionar uma dependencia extra, o campo `state` e salvo automaticamente como `MandatoryOn` (oculto na UI) para manter compatibilidade com o modelo atual.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 45
Escopo implementado:
- `FeatureStateField` ganhou suporte a `footer`, permitindo colocar opcoes avancadas dentro do mesmo item.
- Aba `Performance` / item `Gamescope` reestruturado:
  - opcoes avancadas agora aparecem no rodape do proprio item `Gamescope` (quando ativado), em vez de itens soltos abaixo;
  - `Metodo de upscale` e `Tipo de janela` migrados para seletores segmentados (estilo tabs lado a lado);
  - `Limitar FPS` e `Forcar captura de cursor` migrados para cards clicaveis com switch, lado a lado;
  - `Opcoes adicionais do gamescope` migradas para fluxo de lista com dialog (estilo `Argumentos de launch`), armazenando o payload como string concatenada para preservar o schema atual.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 46
Escopo implementado:
- Refino visual do bloco de opcoes avancadas de `Gamescope`:
  - paines de `Metodo de upscale`, `Tipo de janela`, `Limitar FPS` e `Forcar captura de cursor` unificados com fundo mais escuro (`muted`) para consistencia visual.
- UI de resolucao do `Gamescope` simplificada:
  - `Resolucao do jogo` agora usa um unico card com par de campos (`largura x altura`);
  - `Resolucao da tela` tambem usa um unico card com par de campos (`largura x altura`);
  - adicionado card clicavel `Obter resolucao do monitor` dentro do card de `Resolucao da tela`.

Semantica atual do card `Obter resolucao do monitor`:
- Quando ativado, limpa `output_width`/`output_height` e define `resolution = null`, sinalizando modo automatico (usar resolucao do monitor).
- Ao digitar manualmente nos campos de resolucao da tela, o modo automatico e desativado implicitamente (pois os campos deixam de estar vazios).

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 47
Escopo implementado:
- Segmentados de `Gamescope` (`Metodo de upscale` e `Tipo de janela`) refinados:
  - trocados para layout em grade (`grid`) com colunas fixas (4 e 3);
  - botoes agora ocupam toda a largura disponivel, sem sobra no final;
  - labels centralizados e com quebra de linha para opcoes mais longas.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 48
Escopo implementado:
- `HDR` na aba `Performance`:
  - deixou de ser um item solto;
  - agora aparece somente quando `Wine-Wayland` estiver em estado ativado (`OptionalOn` ou `MandatoryOn`);
  - o controle de `HDR` foi movido para dentro do rodape do item `Wine-Wayland`.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 49
Escopo implementado:
- `Prime Offload` migrado para politica `FeatureState` (UI + schema):
  - na UI foi renomeado para `Usar GPU dedicada`;
  - agora usa os dois cards `Ativado` + `Obrigatorio` (mesmo padrao das demais politicas).
- `Wine-Wayland`:
  - corrigido rodape/divisor vazio quando `HDR` nao esta visivel.

Compatibilidade de payload / backend:
- `environment.prime_offload` em `luthier-orchestrator-core` mudou de `bool` para `FeatureState`.
- Mantida compatibilidade com configs antigos:
  - o parser aceita tanto `bool` quanto `FeatureState` para `prime_offload`;
  - `true` antigo vira `OptionalOn`;
  - `false` antigo vira `OptionalOff`.
- `launch` do Luthier Orchestrator passou a aplicar variaveis de PRIME offload quando `prime_offload` estiver em estado ligado (`MandatoryOn`/`OptionalOn`).

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)
- `/home/rafael/.cargo/bin/cargo build --workspace`

### 2026-02-24 - Checkpoint 36
Escopo implementado:
- Correcao de integracao Tauri para seletores de arquivo/pasta:
  - habilitado `tauri.allowlist.dialog.open` no `tauri.conf.json` (Tauri v1);
  - sem isso, `@tauri-apps/api/dialog.open()` falhava e a UI caia no fallback web (browser).
- `pickFile` / `pickFolder` (frontend):
  - fallback web agora so acontece quando realmente nao estiver em runtime Tauri;
  - se o app estiver rodando em Tauri e o dialog nativo falhar, o erro eh propagado (nao mascarado como comportamento de navegador/LAN).

Impacto esperado:
- Picker nativo volta a retornar caminho absoluto no executavel Tauri;
- `breadcrumb` da pasta raiz e mini navegador de pastas montadas passam a funcionar no app desktop;
- mensagens de "modo navegador (LAN)" deixam de aparecer indevidamente no executavel Tauri.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 50
Escopo implementado:
- `Winetricks` (aba `Prefix`) consolidado em um unico item:
  - removidos os dois itens separados (`estado` e `lista de verbos`);
  - item unico agora contem titulo/descricao no topo e area de selecao no rodape.
- Nova UX de selecao de verbos (combobox-like):
  - chips removiveis com `x` para os verbos ja selecionados;
  - campo de busca integrado aos chips;
  - lista de resultados abaixo (catalogo filtrado) para clicar e adicionar;
  - `Enter` tenta adicionar match exato ou primeira sugestao.
- Tratamento de erro de catalogo:
  - controller ganhou `winetricksCatalogError`;
  - em erro, campo de busca fica desabilitado e exibe mensagem `Erro ao carregar o catálogo winetricks`;
  - botao `Atualizar catálogo` permanece disponivel para retry.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 51
Escopo implementado:
- Estados vazios padronizados (estilo `Chaves de registro`) em itens de lista:
  - `Argumentos de launch`
  - `Arquivos obrigatorios`
  - `Dependencias extras do sistema`
- `StringListField` ganhou `emptyMessage` opcional para exibir mensagem de lista vazia com borda tracejada.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 52
Escopo implementado:
- `Chaves de registro`:
  - adicionado botao `Adicionar de arquivo (.reg)` ao lado de `Adicionar chave`;
  - fluxo usa picker de arquivo `.reg` e importa entradas diretamente para `registry_keys` (em vez de apenas guardar caminho do arquivo).
- Importacao `.reg` (backend Tauri):
  - novo comando `cmd_import_registry_file`;
  - parser em Rust para arquivos `.reg` com suporte a UTF-8 (com/sem BOM) e UTF-16LE;
  - extrai secoes `[HK...]` e valores para a lista `registry_keys`;
  - ignora entradas de exclusao (`=-`) e linhas nao suportadas, retornando avisos.
- UI:
  - entradas importadas sao mescladas na lista atual de chaves de registro;
  - deduplicacao por assinatura (`path`, `name`, `value_type`, `value`);
  - status informa quantidade importada e numero de avisos.
- Item separado `Import de .reg` removido da aba `Prefix` (fluxo absorvido por `Chaves de registro`).

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)
- `/home/rafael/.cargo/bin/cargo build --workspace`

### 2026-02-24 - Checkpoint 53
Escopo implementado:
- Importacao de `.reg` aprimorada (backend Tauri):
  - parser agora lida melhor com valores `hex(...)` multiline (continuações com `\\`);
  - normaliza payload hexadecimal (bytes comma-separated) para formatos `REG_BINARY`, `REG_MULTI_SZ`, `REG_EXPAND_SZ`, `REG_QWORD` etc.;
  - `DWORD:` passou a ser aceito de forma case-insensitive (`dword:` / `DWORD:`);
  - valores hex inválidos geram aviso, mas a entrada é mantida com payload bruto (fallback).
- UI de importacao de `.reg`:
  - se houver avisos, abre dialog com resumo/lista dos warnings após a importação.

Testes adicionados (luthier-backend):
- parse de `hex(7)` multiline
- parse de `DWORD:` case-insensitive
- warning em hex inválido com manutenção da entrada

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)
- `/home/rafael/.cargo/bin/cargo test -p luthier-backend -- --nocapture`

### 2026-02-24 - Checkpoint 54
Escopo implementado:
- Adicionados scripts de conveniencia na raiz do repositorio para evitar comandos manuais repetitivos:
  - `build-luthier-e-abrir.sh`
    - compila o Luthier via `npm run tauri:build`;
    - ao final abre a pasta `apps/luthier/src-tauri/target/release` no gerenciador de arquivos;
    - lista executaveis encontrados na pasta `release`.
  - `rodar-luthier-lan.sh`
    - sobe o frontend Vite exposto na rede (`0.0.0.0`, porta padrao `1420`);
    - imprime URL local e URL LAN (IP da maquina);
    - verifica conflito de porta e informa processo ocupando a porta quando possivel.
- Ambos:
  - detectam `mise` automaticamente (PATH ou `~/.local/bin/mise`);
  - adicionam `~/.cargo/bin` ao `PATH`;
  - executam `npm install` automaticamente se `node_modules` nao existir.

Validacao do checkpoint:
- `bash -n ./build-luthier-e-abrir.sh ./rodar-luthier-lan.sh`
- `/home/rafael/.cargo/bin/cargo test -p luthier-backend -- --nocapture`

### 2026-02-24 - Checkpoint 27
Escopo implementado:
- Tema visual do Luthier migrado para dark mode inspirado no shadcn:
  - tokens globais (`--background`, `--foreground`, `--card`, `--input`, `--border`, etc.) alterados para paleta escura;
  - `color-scheme: dark` habilitado no `:root`;
  - gradientes de fundo ajustados para contraste em ambiente escuro.
- Ajustes de contraste em estados auxiliares:
  - botao de acao secundaria de teste (`.btn-test`) adaptado para dark;
  - botao de remocao/perigo (`.btn-danger`) adaptado para dark;
  - toasts (`info/success/error`) ajustados para fundo/texto de alto contraste no tema escuro.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 28
Escopo implementado:
- Base de componentes alinhada ao padrao solicitado (shadcn/radix-like):
  - novo `ui/sidebar.tsx` com `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`;
  - novo `ui/item.tsx` com composicao de `Item`, `ItemMain`, `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions`, `ItemFooter`;
  - novo `ui/dialog.tsx` para fluxo de criacao via modal.
- Sidebar do Luthier atualizada para estilo semelhante ao exemplo shadcn:
  - novo `features/luthier/AppSidebar.tsx` com icones Tabler e navegacao por abas.
- `FormControls` refatorado para layout em 3 partes:
  - esquerda (titulo/descricao), direita (controle/acao), baixo (linhas, quando aplicavel);
  - `StringListField` e `KeyValueListField` migrados para fluxo “botao -> dialog -> linha adicionada abaixo com remover”.
- Migracoes de itens para fluxo de dialog + linhas:
  - `Hash SHA-256` (campo + acao no mesmo item);
  - `Prefix path final` (campo + acao de copiar no mesmo item);
  - `registry_keys`, `folder_mounts`, `dll_overrides`, `wrapper_commands` agora adicionados via `Dialog` e renderizados em linhas no rodape do item com icone de exclusao.
- Suporte adicional:
  - `@tabler/icons-solidjs` adicionado para icones de sidebar e acoes de lista;
  - `useLuthierController` ganhou helper `pickMountSourceRelative` para uso em dialog de montagem.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)
- `/home/rafael/.cargo/bin/cargo test -p luthier-backend -- --nocapture`

### 2026-02-24 - Checkpoint 29
Escopo implementado:
- Correção visual da sidebar:
  - item longo `Performance e Compatibilidade` deixou de ficar centralizado;
  - `SidebarMenuButton` passou a usar alinhamento `text-left` e suporte melhor a quebra de linha.
- Tema no padrão do site do shadcn (paleta neutral):
  - variaveis CSS reorganizadas em `:root` (light) e `.dark` (dark);
  - tokens migrados para esquema `oklch` (compatível com o padrão atual do shadcn/ui);
  - fundo e superfícies ajustados para visual neutro, sem viés teal/cyan.
- Suporte real a troca de tema no frontend:
  - novo `ThemeProvider` em Solid com persistência (`localStorage`) e suporte `light` / `dark` / `system`;
  - toggle de tema adicionado ao lado do seletor de idioma no header do Luthier;
  - `App.tsx` agora envolve a aplicação com `ThemeProvider`.
- Tailwind ajustado para tokens `oklch` com alpha:
  - `tailwind.config.ts` usa `oklch(var(--token) / <alpha-value>)` para manter suporte a classes como `bg-muted/40`, `ring-ring/50`, etc.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 30
Escopo implementado:
- Ajuste de alinhamento do layout dos itens (`ItemMain`):
  - colunas esquerda/direita agora dividem melhor a largura (`1fr / 1fr`) em telas maiores, conforme regra visual definida.
- Ajuste de largura dos campos simples (`TextInputField`):
  - campos de texto passaram a ocupar toda a largura da coluna direita por padrão;
  - `compact` virou opcional e só deve ser usado quando o campo realmente precisa ser estreito.
- Resultado esperado:
  - itens como `Nome do jogo` ocupam toda a largura do lado direito;
  - itens `campo + botão` (ex.: `Executável principal`, `Hash SHA-256`) mantêm botão no tamanho do texto e input ocupando o espaço restante.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 31
Escopo implementado:
- Alinhamento do item `Ícone extraído`:
  - preview do ícone + botão de ação agora ficam alinhados à direita na coluna de ações;
  - em telas menores, o empilhamento vertical também permanece alinhado à direita.
- Itens de lista sem rodapé vazio:
  - `StringListField` e `KeyValueListField` não renderizam mais a área inferior (nem separador) quando a lista está vazia;
  - removeu placeholders como `Nenhum item adicionado` / `Nenhuma linha adicionada` nesses componentes.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 32
Escopo implementado:
- `Executável principal`:
  - picker agora filtra tipos comuns de launchers Windows (`.exe`, `.bat`, `.cmd`, `.com`).
- `Pasta raiz do jogo`:
  - continua derivada automaticamente da pasta do executável por padrão;
  - novo botão `Escolher outra` para override manual quando o executável está em subpasta;
  - indicador textual no `hint` informa se a pasta raiz está automática ou alterada manualmente.
- `relative_exe_path`:
  - campo removido da UI (continua sendo gerado automaticamente a partir de `exePath` + `gameRoot`).
- `Arquivos obrigatórios (integrity_files)`:
  - dialog de adição agora possui botão para escolher arquivo via picker;
  - seleção tenta abrir na pasta raiz do jogo;
  - valida que o arquivo selecionado esteja dentro da pasta raiz do jogo/subpastas (quando o path completo está disponível);
  - valor salvo no payload como caminho relativo (`./...`).
- Infraestrutura:
  - `StringListField` passou a aceitar ação opcional de picker (`onPickValue`) para fluxos híbridos texto + seleção.
  - `useLuthierController` ganhou helpers para override de pasta raiz e seleção de arquivo obrigatório relativo.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 33
Escopo implementado:
- UX do dialog de `StringListField` com picker opcional melhorada:
  - quando existe `onPickValue`, o dialog agora mostra `input + botão` na mesma linha (em vez de botão solto abaixo);
  - fluxo ficou mais consistente com os demais itens `campo + ação`.
- Aplicado diretamente ao caso de `Arquivos obrigatórios (integrity_files)`.

Observacao de arquitetura:
- `input type=file` nativo nao foi adotado como fonte principal nesses casos porque o Luthier precisa de caminho real/absoluto (Tauri dialog) para calcular/validar caminhos relativos com confianca. O fallback web continua existindo via `pickFile`.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 34
Escopo implementado:
- Picker de `Executável principal` reforçado:
  - filtro visual continua por extensões Windows launcher;
  - validação adicional no retorno rejeita extensões fora de `.exe`, `.bat`, `.cmd`, `.com`.
- `Pasta raiz do jogo` exibida como caminho relativo ao diretório do executável:
  - mesma pasta do executável => `./`
  - pasta ancestral escolhida manualmente => `../`, `../../`, `../../../`, etc.
- Regra de negócio reforçada:
  - ao escolher outra pasta raiz, a UI valida que o executável principal está dentro dessa pasta/subpastas;
  - seleção inválida é rejeitada com mensagem de status.
- Fallback web de `pickFolder` melhorado:
  - não usa mais `webkitdirectory` (que parecia “upload de arquivos”);
  - agora solicita apenas o caminho da pasta via prompt quando Tauri dialog não está disponível.
- `pickFile` fallback web:
  - passou a respeitar extensões dos filtros (`accept`) para reduzir seleção de tipos errados.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 35
Escopo implementado:
- Correcao de erro em `Calcular hash` no modo navegador/LAN:
  - a UI agora bloqueia a acao quando `exePath` nao eh caminho absoluto e mostra mensagem explicando que hash exige app Tauri local;
  - evita enviar caminho incompleto (ex.: apenas nome do arquivo) para o backend, que gerava `os error 2`.
- Correcao de erro em importacao de `.reg` no modo navegador/LAN:
  - antes de chamar o backend, a UI valida se o arquivo selecionado tem caminho absoluto;
  - quando o picker web retorna apenas nome do arquivo, a UI mostra mensagem clara orientando uso do app Tauri local.
- Picker de `Executavel principal`:
  - passou a reutilizar `defaultPath` (diretorio do executavel atual ou `gameRoot`) quando houver contexto, reduzindo abertura em `Recentes` nas reselecoes.
- Picker de override da `Pasta raiz do jogo`:
  - passou a sugerir `defaultPath` no diretorio do executavel quando usa seletor do sistema.
- `Pasta raiz do jogo` (UX guiada):
  - botao `Escolher outra` agora abre um dialog com breadcrumb e lista de ancestrais da pasta do executavel;
  - usuario so pode escolher niveis ancestrais validos (regra: executavel precisa estar dentro da pasta raiz).
- `Pastas montadas (folder_mounts)`:
  - novo mini navegador de pastas (dialog) restrito a `gameRoot`, com breadcrumb e lista de subpastas;
  - selecao de pasta para montagem usa `Usar esta pasta` e grava caminho relativo;
  - evita escolher diretórios fora da pasta raiz do jogo.
- Backend Tauri:
  - novo comando `cmd_list_child_directories` para listar subpastas (base do mini navegador de pastas).

Observacao importante (UX/arquitetura):
- No modo frontend em navegador/LAN, o fallback web de `input[type=file]` nao fornece caminho absoluto por restricao de seguranca do browser.
- Operacoes que dependem de caminho real no filesystem (hash do `.exe`, importacao de `.reg`, mini navegador de pastas) devem ser feitas no app Tauri local.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)
- `/home/rafael/.cargo/bin/cargo build --workspace`

### 2026-02-24 - Checkpoint 42
Escopo implementado:
- Super refatoracao estrutural do Luthier UI (sem mudanca funcional):
  - `LuthierPage.tsx` foi reduzido e dividido por abas em `src/features/luthier/sections/` (`game`, `runtime`, `performance`, `dependencies`, `winecfg`, `launch-environment`, `review`);
  - helpers/estruturas compartilhadas da tela foram extraidos para `luthier-page-shared.tsx`.
- Refatoracao de componentes de formulario:
  - `FormControls.tsx` virou um barrel pequeno que reexporta modulos menores;
  - componentes foram divididos em `form-controls-core.tsx`, `form-controls-feature-state.tsx` e `form-controls-lists.tsx`.
- Refatoracao do controller do Luthier:
  - constantes e utilitarios de path/lista/runtime foram extraidos de `useLuthierController.ts` para `luthier-controller-utils.ts`.
  - objetivo: reduzir ruido no hook e deixar a logica principal mais legivel.

Observacoes de arquitetura:
- A API publica dos componentes de formulario e do `useLuthierController` foi preservada para evitar regressao nas abas ja existentes.
- Ainda existem alvos de refatoracao para uma proxima rodada (`winecfg-tab.tsx` e `luthier-copy.ts`, ambos grandes), mas a leitura humana do fluxo principal melhorou significativamente nesta etapa.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 43
Escopo implementado:
- Refatoracao do `winecfg-tab` em subcomponentes por responsabilidade:
  - itens base (`DLL overrides`, `Versão do Windows`);
  - secoes do acordeao (`Graphics`, `Desktop Integration`, `Drives`, `Audio`) em arquivos dedicados dentro de `sections/winecfg/`.
- `winecfg-tab.tsx` virou arquivo Luthier Orchestrator pequeno, com composicao das secoes e controle de abertura/fechamento.
- Refatoracao do catalogo de i18n da feature Luthier:
  - `luthier-copy.ts` agora eh apenas compositor/lookup/format;
  - mensagens foram separadas por idioma em `luthier-copy.pt-BR.ts` e `luthier-copy.en-US.ts`.

Boas praticas aplicadas nesta etapa:
- separacao por responsabilidade (componentes por secao visual e dados por idioma);
- manutencao da API publica existente (sem alterar chamadas de `ct(...)` / `creatorTranslate(...)`);
- refatoracao incremental com validacao de build apos cada bloco.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 44
Escopo implementado:
- Rodada de checagem estatica/lint no projeto (frontend + Rust) e correcoes:
  - frontend: `npx tsc --noEmit` (strict) passou apos ajustes;
  - Rust: `cargo clippy --workspace --all-targets -- -D warnings` passou;
  - Rust: `cargo fmt --all` aplicado (ajustes de formatacao em arquivos Rust).
- Ajustes de infraestrutura para typecheck frontend:
  - adicionado `@types/node` em `devDependencies` do Luthier;
  - `tsconfig.json` atualizado com `types: ["vite/client", "node"]` e `skipLibCheck: true` (para evitar ruido de typings de terceiros como Kobalte/Vite e focar no codigo da app).
- Correcoes de tipagem/codigo apos a grande refatoracao:
  - `LuthierPageSectionView` agora tipado como `LuthierController & Record<string, any>` (reduzindo `implicit any` nas abas);
  - imports faltantes corrigidos nas abas (`runtime` e `performance`);
  - `Button` recebeu suporte a `size=\"icon\"` (uso existente no Luthier);
  - typing do wrapper `Dialog` ajustado para evitar erro de generic com Kobalte root.

Observacao:
- Restaram `any` apenas nos estados locais transitórios expostos via `view` genérico das abas refatoradas; isso foi mantido como tradeoff controlado para preservar funcionalidade durante a refatoracao incremental.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npx tsc --noEmit` (frontend)
- `/home/rafael/.cargo/bin/cargo clippy --workspace --all-targets -- -D warnings`
- `/home/rafael/.cargo/bin/cargo fmt --all`

### 2026-02-24 - Checkpoint 45
Escopo implementado:
- Scripts locais de qualidade adicionados na raiz do projeto (`scripts/`):
  - `scripts/check-frontend-quality.sh` -> `typecheck + build` do Luthier frontend;
  - `scripts/check-rust-quality.sh` -> `cargo fmt --check + cargo clippy -D warnings` (com flags opcionais `--exclude-tauri` e `--with-tests`);
  - `scripts/check-quality.sh` -> agregador frontend + Rust (usa `--exclude-tauri` por padrao para estabilidade).
- Scripts do frontend (`apps/luthier/package.json`):
  - `typecheck`, `lint` (alias para typecheck) e `quality`.
- CI do GitHub (`.github/workflows/ci.yml`) reestruturado:
  - job `frontend` com `npm ci`, `npm run typecheck`, `npm run build`;
  - job `rust-core` com `fmt`, `test` e `clippy` excluindo `luthier-backend` (evita instabilidade por dependencias de sistema/GTK/WebKit do Tauri em runners padrao).
- Scripts locais ficaram robustos ao ambiente do usuario:
  - `check-frontend-quality.sh` detecta `mise` no PATH ou em `~/.local/bin/mise` automaticamente.

Validacao do checkpoint:
- `./scripts/check-frontend-quality.sh`
- `./scripts/check-rust-quality.sh --exclude-tauri`
- `./scripts/check-quality.sh`

### 2026-02-24 - Checkpoint 46
Escopo implementado:
- Fluxo de geracao do Luthier reforcado para uso real (Tauri app / build empacotado):
  - backend Tauri (`apps/luthier/src-tauri/src/lib.rs`) ganhou resolucao robusta do binario base do Luthier Orchestrator com busca por:
    - `LUTHIER_BASE_ORCHESTRATOR` (env var),
    - caminho solicitado pelo frontend,
    - candidatos comuns (`target/debug`, `target/release`),
    - recurso empacotado do Tauri (`resources/luthier-orchestrator-base/luthier-orchestrator`);
  - comandos do backend passaram a emitir logs estruturados JSON (`luthier-backend`, `event_code`, `context`) para debug humano/IA.
- Wrapper Tauri (`apps/luthier/src-tauri/src/main.rs`) atualizado:
  - `cmd_create_executable` agora injeta hints reais de path (`resolve_resource`, `resource_dir`, `app_data_dir`) ao backend na hora da geracao.
- Empacotamento Tauri preparado para distribuir o binario base:
  - `tauri.conf.json` inclui `bundle.resources = ["resources/luthier-orchestrator-base/luthier-orchestrator"]`.
- Scripts de build/dev do Luthier agora preparam automaticamente o Luthier Orchestrator base:
  - novo script `apps/luthier/scripts/prepare-luthier-orchestrator-base.sh` (debug/release);
  - `package.json` (`tauri:dev`, `tauri:build`, `tauri:bundle`) executa esse script antes do Tauri;
  - `build-luthier-e-abrir.sh` tambem compila/copia o Luthier Orchestrator base para recursos.
- Validacao pratica da injecao de payload:
  - `luthier-cli create` gerou um executavel ELF do Luthier Orchestrator com payload embutido;
  - o binario gerado respondeu corretamente a `--show-config`, confirmando leitura do trailer/config embutida.

Observacoes:
- A validacao acima prova o pipeline de `copy + inject JSON` mesmo antes de concluir a UX final do Luthier Orchestrator (splash/config nativa).
- O Luthier UI continua usando um `base_binary_path` legado na requisicao, mas o backend agora resolve esse valor de forma tolerante e registra o caminho final usado (`resolved_base_binary_path`).

Validacao do checkpoint:
- `/home/rafael/.cargo/bin/cargo build -p orchestrator`
- `./apps/luthier/scripts/prepare-luthier-orchestrator-base.sh debug`
- `/home/rafael/.cargo/bin/cargo build -p luthier-backend`
- `cargo check` do `luthier-backend` com `--features tauri-commands` (via compat shims)
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)
- `/home/rafael/.cargo/bin/cargo test -p luthier-backend -- --nocapture`
- `luthier-cli create ...` + `orchestrator-generated --show-config`

### 2026-02-24 - Checkpoint 47
Escopo implementado:
- Correcao de bug no fluxo real do Luthier Orchestrator (`--play` / `--winecfg`) durante setup inicial do prefixo:
  - antes de executar o plano de setup (`wineboot`, `winetricks`), o executor agora garante a criacao do diretorio do prefixo (`~/.local/share/Luthier/prefixes/<exe_hash>`).
- A correcao foi aplicada no `luthier-orchestrator-core` (`process.rs`), de forma generica para todos os comandos que reutilizam `execute_prefix_setup_plan`, evitando duplicar logica em `play.rs` e `winecfg.rs`.

Sintoma que foi corrigido:
- `wine: chdir to .../prefixes/<hash> : Arquivo ou diretório inexistente`
- Falha do passo obrigatorio `wineboot-init` com abort do launch.

Validacao do checkpoint:
- `/home/rafael/.cargo/bin/cargo build -p orchestrator`
- `/home/rafael/.cargo/bin/cargo test -p luthier-orchestrator-core process:: -- --nocapture`

### 2026-02-24 - Checkpoint 48
Escopo implementado:
- Correcao da invocacao de Proton Native/UMU no launch/winecfg:
  - `ProtonNative` agora usa `proton run <exe>` (antes chamava o script do Proton sem o verbo `run`);
  - env do launch/winecfg para runtimes Proton agora inclui `STEAM_COMPAT_DATA_PATH` e, quando derivavel, `STEAM_COMPAT_CLIENT_INSTALL_PATH`;
  - `WINEPREFIX` efetivo para Proton passa a apontar para `<prefix_root>/pfx`.
- Alinhamento do setup inicial do prefixo e mounts com o prefixo efetivo do runtime:
  - `play.rs` e `winecfg.rs` usam `.../pfx` como prefixo efetivo para setup/mounts quando runtime selecionado eh Proton.

Sintoma que motivou a correcao:
- `Proton: No compat data path?`
- launch plan mostrava args sem `run` e env sem `STEAM_COMPAT_DATA_PATH`.

Observacao:
- O popup de Wine Mono no primeiro `wineboot` continua possivel em prefixo novo (comportamento esperado do Wine; nao eh erro de versao do Proton).

Validacao do checkpoint:
- `/home/rafael/.cargo/bin/cargo build -p orchestrator`
- `/home/rafael/.cargo/bin/cargo test -p luthier-orchestrator -- --nocapture`

### 2026-02-24 - Checkpoint 49
Escopo implementado:
- Aplicacao de `registry_keys` no Luthier Orchestrator (pendencia funcional fechada para fluxo basico):
  - apos o setup do prefixo, o Luthier Orchestrator gera um `.reg` temporario dentro do prefixo (`drive_c/windows/temp`) e executa import via `regedit` com o runtime selecionado (Wine/Proton/UMU);
  - suporta tipos principais usados no MVP/imports atuais (`REG_SZ`, `REG_DWORD`, `REG_BINARY`, `REG_MULTI_SZ`, `REG_EXPAND_SZ`, `REG_QWORD`);
  - falha de import passa a abortar `--play`/`--winecfg` com saida estruturada (`registry_apply`).
- Prefix setup mais inteligente / idempotente:
  - filtragem de verbos do `winetricks` ja instalados lendo `winetricks.log` do prefixo efetivo;
  - evita rerodar `winetricks` a cada launch quando os verbos ja estao presentes (reduz risco de conflitos e tempo de startup).
- Logs/saida JSON:
  - `--play` e `--winecfg` agora incluem `registry_apply` na saida final (ou de erro), facilitando debug.

Observacoes:
- Essa etapa ataca diretamente os dois problemas vistos no teste real do Age of Empires III:
  1) entradas de registro nao aplicadas;
  2) rerun de winetricks em toda execucao (que estava contribuindo para conflitos de runtime).

Validacao do checkpoint:
- `/home/rafael/.cargo/bin/cargo build -p orchestrator`
- `/home/rafael/.cargo/bin/cargo test -p luthier-orchestrator -- --nocapture`
