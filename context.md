# Projeto: Empacotador/Orquestrador de Jogos Windows no Linux

## 1) Objetivo
Construir uma aplicacao desktop Linux (App Criador em Tauri) que gera um binario nativo portatil (Orquestrador) ao lado do `.exe` do jogo.  
O Orquestrador deve ler configuracao embutida no proprio executavel, validar ambiente, preparar prefix/runtime e iniciar o jogo com wrappers de performance.

---

## 2) Escopo e Componentes

### 2.1 App Criador (Tauri)
- Coleta parametros do usuario.
- Sanitiza paths e gera `GameConfig`.
- Permite configurar "Pastas Montadas" (origem na pasta do jogo -> destino Windows no prefixo).
- Permite definir politica por componente com 4 estados (`MandatoryOn`, `MandatoryOff`, `OptionalOn`, `OptionalOff`).
- Permite definir estrategia de runtime: estrito ou com fallback.
- Extrai icone de `.exe` para preview.
- Persiste perfis em banco local (MVP).
- Copia binario base do Orquestrador e injeta configuracao JSON.
- Prepara contrato de API comunitaria para fase posterior.

### 2.2 Orquestrador (binario gerado)
- Abre splash screen minimalista ao iniciar por duplo clique.
- Le configuracao embutida no proprio binario.
- Roda `doctor`, aplica politica de requisitos e monta plano de execucao.
- Prepara prefix e dependencias.
- Aplica montagens de pastas no prefixo (com validacao estrita).
- Inicia jogo com wrappers (gamescope/gamemode/mangohud) conforme configuracao.
- Exibe opcao de configuracao rapida apenas para features nao obrigatorias.
- Exibe avaliacao pos-jogo.
- Persiste resultado localmente e envia remoto apenas se telemetria opt-in estiver ativa.

### 2.3 Servidor Comunitario (fora do MVP inicial)
- API REST para perfis por hash SHA-256 do `.exe`.
- Endpoint para resultados anonimos de sessao.

---

## 3) Stack Tecnologica
- Frontend: Tauri + Rust + SolidJS (escolha de simplicidade/manutencao/leveza).
- Backend local App Criador: `std::process::Command`, `tauri-plugin-fs`, `reqwest`, `image`.
- Orquestrador: `serde`, `serde_json`, `tokio`, `sysinfo`, `rfd` ou `zenity`.
- Banco local MVP: SQLite (`rusqlite` ou `sqlx` com SQLite).
- Ferramenta externa permitida para icone: `wrestool`/`icotool`.
- i18n frontend: `@solid-primitives/i18n` (ou `i18next`) com dicionarios por namespace.
- i18n Rust (CLI/splash): `fluent-bundle` + `unic-langid`.

---

## 4) Modelo de Dados

### 4.1 Estruturas base
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct GameConfig {
    pub config_version: u32,
    pub created_by: String,
    pub game_name: String,
    pub exe_hash: String,
    pub relative_exe_path: String,
    pub launch_args: Vec<String>,
    pub runner: RunnerConfig,
    pub environment: EnvConfig,
    pub compatibility: CompatibilityConfig,
    pub winecfg: WinecfgConfig,
    pub dependencies: Vec<String>,
    pub extra_system_dependencies: Vec<SystemDependency>,
    pub requirements: RequirementsConfig,
    pub registry_keys: Vec<RegistryKey>,
    pub integrity_files: Vec<String>, // arquivos obrigatorios na pasta do jogo
    pub folder_mounts: Vec<FolderMount>,
    pub scripts: ScriptsConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RunnerConfig {
    pub proton_version: String,
    pub auto_update: bool,
    pub esync: bool,
    pub fsync: bool,
    pub runtime_preference: RuntimePreference, // Auto, Proton, Wine
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EnvConfig {
    pub gamemode: FeatureState,
    pub gamescope: GamescopeConfig,
    pub mangohud: FeatureState,
    pub prime_offload: bool,
    pub custom_vars: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompatibilityConfig {
    pub wine_wayland: FeatureState,
    pub hdr: FeatureState,
    pub auto_dxvk_nvapi: FeatureState,
    pub easy_anti_cheat_runtime: FeatureState,
    pub battleye_runtime: FeatureState,
    pub staging: FeatureState,
    pub wrapper_commands: Vec<WrapperCommand>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WinecfgConfig {
    pub dll_overrides: Vec<DllOverrideRule>,
    pub auto_capture_mouse: FeatureState,
    pub window_decorations: FeatureState,
    pub window_manager_control: FeatureState,
    pub virtual_desktop: VirtualDesktopConfig,
    pub desktop_integration: FeatureState,
    pub drives: Vec<WineDriveMapping>,
    pub audio_driver: Option<String>, // "pipewire", "pulseaudio", "alsa"
}
```

### 4.2 Estruturas complementares
```rust
#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
pub enum FeatureState {
    MandatoryOn,
    MandatoryOff,
    OptionalOn,
    OptionalOff,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
pub enum RuntimePreference {
    Auto,
    Proton,
    Wine,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
pub enum RuntimeCandidate {
    ProtonUmu,
    ProtonNative,
    Wine,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequirementsConfig {
    pub runtime: RuntimePolicy,
    pub umu: FeatureState,
    pub winetricks: FeatureState,
    pub gamescope: FeatureState,
    pub gamemode: FeatureState,
    pub mangohud: FeatureState,
    pub steam_runtime: FeatureState,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RuntimePolicy {
    pub strict: bool, // true = nao usa fallback
    pub primary: RuntimeCandidate,
    pub fallback_order: Vec<RuntimeCandidate>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GamescopeConfig {
    pub state: FeatureState,
    pub resolution: Option<String>, // "1920x1080"
    pub fsr: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WrapperCommand {
    pub state: FeatureState,
    pub executable: String,
    pub args: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DllOverrideRule {
    pub dll: String,  // ex: "d3dcompiler_47"
    pub mode: String, // "builtin", "native", "builtin,native", "native,builtin", "disabled"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VirtualDesktopConfig {
    pub state: FeatureState,
    pub resolution: Option<String>, // obrigatorio quando state ativado
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WineDriveMapping {
    pub letter: String,               // ex: "D"
    pub source_relative_path: String, // relativo a pasta do jogo
    pub state: FeatureState,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemDependency {
    pub name: String,                 // ex: "vulkaninfo"
    pub state: FeatureState,
    pub check_commands: Vec<String>,  // preferencial: comandos no PATH
    pub check_env_vars: Vec<String>,  // alternativa: env vars conhecidas
    pub check_paths: Vec<String>,     // fallback: caminhos padrao do sistema
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegistryKey {
    pub path: String,
    pub name: String,
    pub value_type: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScriptsConfig {
    pub pre_launch: String,  // bash
    pub post_launch: String, // bash
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FolderMount {
    pub source_relative_path: String, // sempre relativo a pasta raiz do jogo
    pub target_windows_path: String,  // ex: "C:\\users\\steamuser\\Documents\\MeuJogo"
    pub create_source_if_missing: bool,
}
```

### 4.3 Regras de scripts
- Aceitar somente codigo bash local fornecido pelo usuario.
- Nao enviar scripts para API.

### 4.4 Regras de pastas montadas
- `source_relative_path` deve ser relativo a pasta raiz do jogo.
- Nao permitir origem absoluta.
- Nao permitir escapes (`..`) apos normalizacao.
- Validar origem com canonicalizacao real (`realpath`) e confirmar que continua dentro da pasta raiz do jogo.
- Se `create_source_if_missing=true`, criar a pasta de origem automaticamente dentro da pasta do jogo.
- `target_windows_path` deve estar em formato Windows com letra de drive (`C:\\...`).
- Nao permitir destino UNC (`\\\\server\\share`) nem variaveis (`%USERPROFILE%`).
- Permitir multiplos mapeamentos, sem destinos duplicados.

### 4.5 Regras de politica de requisitos
- Cada componente usa `FeatureState` com 4 modos:
  - `MandatoryOn`: ligado e obrigatorio.
  - `MandatoryOff`: desligado e bloqueado para override.
  - `OptionalOn`: ligado por padrao, mas pode ser desligado.
  - `OptionalOff`: desligado por padrao, mas pode ser ligado.
- `runtime.strict=true`: usa apenas `runtime.primary`; se faltar, bloqueia.
- `runtime.strict=false`: tenta `runtime.primary` e depois `fallback_order` ate achar um disponivel.
- Coerencia obrigatoria no App Criador:
  - se `FeatureState` for `MandatoryOn`, o componente externo correspondente nao pode ficar desligado.
  - se `FeatureState` for `MandatoryOff`, o componente externo correspondente deve ser considerado desativado no plano.
- Regra especial de dependencias Winetricks:
  - se `dependencies` estiver vazio, usar `OptionalOff` ou `MandatoryOff`.
  - se `dependencies` tiver itens:
    - `MandatoryOn`: falta de winetricks bloqueia setup.
    - `OptionalOn`/`OptionalOff`: setup pode ser pulado com aviso.
    - `MandatoryOff`: sempre pula setup.

### 4.6 Regras para compatibilidade (Wine-Wayland, HDR, DXVK-NVAPI, anticheat, staging)
- `wine_wayland`:
  - `MandatoryOn`: runtime precisa suportar wine-wayland; se nao suportar, `BLOCKER`.
  - `MandatoryOff`: forca desativado.
  - `OptionalOn`/`OptionalOff`: pode ser alterado em `--config`.
- `hdr`:
  - So pode ser efetivo com `wine_wayland` ativo.
  - `MandatoryOn` com `wine_wayland` inativo/incompativel vira `BLOCKER`.
  - `MandatoryOff`: forca HDR desligado.
- `auto_dxvk_nvapi`:
  - `MandatoryOn`: se runtime nao suportar, `BLOCKER`.
  - `OptionalOn`/`OptionalOff`: aplica quando suportado; caso contrario, `WARN`.
  - `MandatoryOff`: forca sem NVAPI.
- `easy_anti_cheat_runtime` e `battleye_runtime`:
  - `MandatoryOn`: runtime local correspondente precisa existir, sem download automatico no MVP.
  - `OptionalOn`/`OptionalOff`: habilita apenas quando disponivel; senao, `WARN`.
  - `MandatoryOff`: forca desativado.
- `staging`:
  - `MandatoryOn`: requer runner Wine com suporte a staging; se nao houver, `BLOCKER`.
  - `MandatoryOff`: forca sem staging.
  - `OptionalOn`/`OptionalOff`: habilita/desabilita conforme disponibilidade.

### 4.7 Regras para wrapper command e variaveis de ambiente
- `wrapper_commands`:
  - Cada entrada possui `FeatureState`.
  - `MandatoryOn`: falha ao localizar comando gera `BLOCKER`.
  - `OptionalOn`/`OptionalOff`: falha gera `WARN` e comando e ignorado.
  - `MandatoryOff`: comando nao deve ser executado.
- Validacao de seguranca para wrappers:
  - validar `executable` como binario resolvivel.
  - sem expansao shell implicita; montar argumentos como vetor.
- `environment.custom_vars`:
  - Chaves definidas pelo usuario sao aplicadas por ultimo, exceto chaves protegidas do orquestrador.
  - Chaves protegidas (nao sobrescreviveis): `WINEPREFIX`, `PROTON_VERB`.
  - Tentativa de sobrescrever chave protegida gera `WARN` e e ignorada.

### 4.8 Regras para opcoes do winecfg
- `dll_overrides`: validar `mode` em:
  - `builtin`, `native`, `builtin,native`, `native,builtin`, `disabled`.
- `auto_capture_mouse`, `window_decorations`, `window_manager_control`, `desktop_integration`:
  - aplicar como estado com 4 modos (`MandatoryOn`, `MandatoryOff`, `OptionalOn`, `OptionalOff`).
- `virtual_desktop`:
  - quando estado ativo (`MandatoryOn`/`OptionalOn`), `resolution` e obrigatoria (`<largura>x<altura>`).
  - `MandatoryOff`: nunca emular desktop virtual.
- `drives`:
  - aceitar apenas letras unicas (`A`-`Z`).
  - `source_relative_path` sempre dentro da pasta raiz do jogo.
  - defaults de compatibilidade:
    - `C:` fixo para `drive_c` (interno do prefixo, nao editavel)
    - `Z:` em `OptionalOn` por padrao
- `audio_driver`:
  - valores permitidos: `pipewire`, `pulseaudio`, `alsa`.

### 4.9 Regras para dependencias extras e arquivos obrigatorios
- `extra_system_dependencies`:
  - cada item usa `FeatureState`.
  - verificacao deve priorizar:
    1. comandos em `PATH`
    2. env vars conhecidas
    3. caminhos padrao do sistema (somente fallback)
  - `MandatoryOn` ausente: `BLOCKER`.
  - `OptionalOn`/`OptionalOff` ausente: `WARN`.
  - `MandatoryOff`: ignora verificacao.
  - nao permitir caminho absoluto livre digitado pelo usuario para runtime principal.
- `integrity_files`:
  - representa a lista de arquivos obrigatorios na pasta do jogo.
  - cada caminho deve ser relativo a pasta raiz do jogo.
  - ausencia de qualquer item gera `BLOCKER`.

### 4.10 Persistencia local de configuracoes da app (nao embutido no executavel)
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct AppSettings {
    pub schema_version: u32,
    pub preferred_locale: String, // ex: "pt-BR", "en-US"
    pub telemetry_opt_in: bool,
}
```

Regras:
- `preferred_locale` e configuracao global da App Criador.
- Nao gravar preferencia de idioma dentro de `GameConfig`.
- `telemetry_opt_in` global pode ser sobrescrito por jogo apenas se houver toggle explicito na UI.

---

## 5) Estrategia de Geracao do Orquestrador

### 5.1 Regra principal
Nao compilar Rust no host final.  
Usar binario base pre-compilado em assets da App Criador.

### 5.2 Fluxo de geracao
1. Usuario clica em "Criar Executavel".
2. App valida entradas e monta `GameConfig`.
3. App copia `orchestrator-base` para pasta do jogo.
4. App injeta payload no final do binario.

### 5.3 Formato de payload (decisao aceita)
Trailer robusto:
- `[bytes binario base]`
- `[json bytes]`
- `[magic: "GOCFGv1"]`
- `[json_len: u64 little-endian]`
- `[sha256_json: 32 bytes]`

Beneficios:
- Parse deterministico de tras para frente.
- Deteccao de corrupcao.
- Evita falso positivo de delimitador.

---

## 6) Portabilidade e Paths
- Todos os paths de jogo no payload devem ser relativos ao diretorio do Orquestrador.
- Prefix por hash: `~/.local/share/GameOrchestrator/prefixes/<exe_hash>/`.
- Resolver base em runtime com `current_exe().parent()`.
- Runtime deve validar paths do payload novamente (defesa em profundidade):
  - recusar path absoluto Linux (`/`), absoluto Windows (`C:\...`) e traversal (`..`) inclusive com separador `\`.
- Em `folder_mounts`, a origem deve estar sempre dentro da pasta raiz do jogo (com validacao de symlink/realpath).
- Nao persistir caminho absoluto manual para runtime no payload.
- Descoberta de runtime deve usar `PATH`, env vars conhecidas e caminhos padrao do sistema.

---

## 7) Fluxo de Execucao do Orquestrador (ordem obrigatoria)

### 7.1 Regra de interface na abertura
- Ao iniciar por duplo clique, abrir splash screen pequena e minimalista.
- A splash deve mostrar status em tempo real do pipeline.
- Em `--play`, permitir modo silencioso sem splash.

### 7.2 Pipeline funcional
1. Self-read e parse:
- Ler o proprio executavel.
- Extrair payload/trailer.
- Validar hash e tamanho.
- Desserializar `GameConfig`.

2. CLI check:
- `--play`: inicia silencioso.
- `--config`: gerencia overrides locais de features opcionais (`mangohud`, `gamescope`, `gamemode`).
- `--config` suporta:
  - `--set-mangohud on|off|default`
  - `--set-gamescope on|off|default`
  - `--set-gamemode on|off|default`
- Overrides sao persistidos por jogo em:
  - `~/.local/share/GameOrchestrator/overrides/<exe_hash>.json`
- `--doctor`: valida ambiente sem launch.
- `--verbose`: logs detalhados.
- `--show-config`: imprime configuracao embutida.

3. Integrity:
- Validar existencia de `relative_exe_path`.
- Validar `integrity_files`.

4. Doctor e discovery runtime:
- Checar componentes de runtime e wrappers na seguinte ordem:
  - `PATH` (preferencial)
  - env vars conhecidas (`PROTONPATH`, `STEAM_COMPAT_TOOL_PATHS`, `WINE`, `UMU_RUNTIME`)
  - caminhos padrao do sistema (fallback de descoberta)
- Procurar Proton em:
  - `~/.local/share/Steam/compatibilitytools.d/`
  - `~/.steam/root/compatibilitytools.d/`
  - `~/.steam/steam/compatibilitytools.d/`
  - `~/.local/share/Steam/steamapps/common/`
  - `~/.steam/root/steamapps/common/`
  - `~/.steam/steam/steamapps/common/`
- Procurar Wine via `PATH`, `/usr/bin/wine`, `/usr/local/bin/wine`, `~/.local/bin/wine`.
- Procurar `umu-run` via `PATH` e fallback local.
- Validar binarios encontrados como executaveis (nao apenas existencia de arquivo).
- Montar um `ExecutionPlan` com status por item:
  - `BLOCKER` (violou `MandatoryOn`)
  - `WARN` (item opcional indisponivel, sera desativado/fallback)
  - `INFO` (item em `MandatoryOff`, desativado por politica)
  - `OK`
- Verificar `extra_system_dependencies` (comando/env/path padrao) e anexar resultado no plano.
- Resolver runtime efetivo conforme politica:
  - `strict=true`: usa apenas `primary`
  - `strict=false`: tenta `primary` + `fallback_order`
- Se faltar dependencia, mostrar na splash exatamente o que esta ausente e se e bloqueio ou degradacao.

5. Error handling sem download automatico:
- Se nao encontrar runtime viavel, exibir modal com opcoes:
  - mostrar quais dependencias faltam e onde sao normalmente instaladas
  - cancelar para instalar manualmente e tentar novamente
- Nao baixar dependencias automaticamente no MVP.

6. Setup do prefix:
- Verificar se prefix existe e esta preparado.
- Se nao existir, criar prefix.
- Rodar `wineboot` ou `createprefix` (quando usando UMU/Proton).
- Rodar dependencias (`winetricks -q ...` ou equivalente) apenas quando aplicavel no `ExecutionPlan`.
- Aplicar `.reg` se houver.
- Aplicar timeout e diagnostico de erro.
- Exibir progresso na splash com mensagens de etapa:
  - `Criando prefixo`
  - `Instalando winetricks: <item>`
  - `Aplicando configuracoes de registro`

7. Aplicacao de compatibilidade e winecfg:
- Aplicar `compatibility` no plano final (wine-wayland, hdr, dxvk-nvapi, eac, battleye, staging).
- Aplicar `winecfg`:
  - dll overrides
  - auto capture mouse
  - decoracao/controle de janelas pelo WM
  - virtual desktop e resolucao
  - desktop integration
  - mapeamento de unidades
  - driver de audio
- Exibir progresso na splash:
  - `Aplicando configuracoes de compatibilidade`
  - `Aplicando configuracoes do winecfg`

8. Montagem de pastas (folder mounts):
- Para cada item em `folder_mounts`, validar origem e destino.
- Garantir que origem resolvida continue dentro da pasta raiz do jogo.
- Resolver destino Windows para caminho Unix dentro do prefixo (via `dosdevices`).
- Criar pasta de origem se permitido (`create_source_if_missing`).
- Aplicar montagem por symlink no prefixo:
  - exemplo: `C:\users\steamuser\Documents\MeuJogo` -> `./save`
- Exibir progresso na splash:
  - `Configurando pastas do jogo`
  - `Montando <origem> em <destino>`

9. Pre-launch e configuracao rapida:
- Rodar `pre_launch` (bash) se definido.
- Aplicar ajustes do `ExecutionPlan` (desativar wrappers opcionais ausentes).
- Avaliar quais features permitem override (`state == OptionalOn || state == OptionalOff`).
- Se existir ao menos uma feature configuravel:
  - mostrar botao `Configurar` na splash
  - mostrar contagem `Iniciando o jogo em 3... 2... 1...`
  - abrir tela pequena de configuracao quando `Configurar` for acionado
- Se todas as features relevantes estiverem em `MandatoryOn` ou `MandatoryOff`:
  - nao mostrar botao `Configurar`
  - nao mostrar contagem regressiva
  - seguir para launch imediato

10. Launch:
- Montar linha de execucao com wrappers conforme `FeatureState` + `ExecutionPlan`.
- Ordem de wrappers:
  - `gamescope` primeiro (quando ativo)
  - wrappers customizados
  - `mangohud` (somente fora de gamescope; com gamescope usar `--mangoapp`)
  - `gamemoderun`
  - steam runtime (quando aplicavel e disponivel)
  - runner final (umu/proton/wine)
- Encerrar comando de gamescope com `--` como ultimo token do wrapper.
- Spawn do processo principal e `wait()`.

11. Post game:
- Rodar `post_launch` (bash) se definido.
- Modal de avaliacao: `Perfeito`, `Jogavel`, `Crash`.
- Persistir resultado local.
- Enviar HTTP async apenas se opt-in ativo.

### 7.3 Matriz de comportamento por requisito
- Runtime (`umu/proton/wine`):
  - `MandatoryOn` e sem candidato viavel: bloqueia.
  - `OptionalOn`/`OptionalOff` com fallback habilitado: tenta proximo candidato.
  - `MandatoryOff`: desabilita candidato marcado e nao tenta ele.
- `gamescope`:
  - `MandatoryOn` e ausente: bloqueia.
  - `MandatoryOff`: nunca ativa, mesmo se instalado.
  - `OptionalOn` e ausente: desativa e segue com `WARN`.
  - `OptionalOff`: inicia desativado; ativa somente por override permitido.
- `gamemode`:
  - `MandatoryOn` e ausente: bloqueia.
  - `MandatoryOff`: nunca ativa.
  - `OptionalOn` e ausente: desativa e segue com `WARN`.
  - `OptionalOff`: inicia desativado; ativa somente por override permitido.
- `mangohud`:
  - `MandatoryOn` e ausente: bloqueia.
  - `MandatoryOff`: nunca ativa.
  - `OptionalOn` e ausente: desativa overlay e segue com `WARN`.
  - `OptionalOff`: inicia desativado; ativa somente por override permitido.
- `winetricks` (quando ha `dependencies`):
  - `MandatoryOn` e ausente: bloqueia setup.
  - `MandatoryOff`: sempre pula install.
  - `OptionalOn`/`OptionalOff` e ausente: pula install com `WARN`.
- `steam_runtime`:
  - `MandatoryOn` e ausente: bloqueia.
  - `MandatoryOff`: nao usa runtime.
  - `OptionalOn`/`OptionalOff` e ausente: segue sem runtime com `WARN`.
- `wine_wayland`:
  - `MandatoryOn` sem suporte no runner: bloqueia.
  - `MandatoryOff`: forca desativado.
  - `OptionalOn`/`OptionalOff`: ativa ou desativa conforme escolha e suporte.
- `hdr`:
  - `MandatoryOn` sem `wine_wayland` ativo: bloqueia.
  - `MandatoryOff`: forca HDR desligado.
  - `OptionalOn`/`OptionalOff`: aplica apenas quando `wine_wayland` estiver ativo.
- `auto_dxvk_nvapi`:
  - `MandatoryOn` sem suporte no runtime: bloqueia.
  - `MandatoryOff`: forca desligado.
  - `OptionalOn`/`OptionalOff`: aplica quando houver suporte; senao `WARN`.
- `easy_anti_cheat_runtime` e `battleye_runtime`:
  - `MandatoryOn` sem runtime local correspondente: bloqueia.
  - `MandatoryOff`: forca desligado.
  - `OptionalOn`/`OptionalOff`: habilita quando disponivel; senao `WARN`.
- `staging`:
  - `MandatoryOn` sem build staging: bloqueia.
  - `MandatoryOff`: forca desativado.
  - `OptionalOn`/`OptionalOff`: ativa/desativa conforme disponibilidade.
- `wrapper_commands`:
  - entradas `MandatoryOn` ausentes/invalidas: bloqueiam.
  - entradas opcionais invalidas: sao ignoradas (degradacao controlada, sem bloquear launch).
- `extra_system_dependencies`:
  - `MandatoryOn` ausente: bloqueia.
  - `MandatoryOff`: ignora.
  - `OptionalOn`/`OptionalOff` ausente: `WARN`.
- `integrity_files`:
  - qualquer arquivo ausente: bloqueia launch.

---

## 8) CLI do Orquestrador (MVP)
- `--play`
- `--config`
- `--set-mangohud on|off|default` (com `--config`)
- `--set-gamescope on|off|default` (com `--config`)
- `--set-gamemode on|off|default` (com `--config`)
- `--doctor`
- `--verbose`
- `--show-config`
- `--lang <locale>` (override explicito de idioma para UI/CLI)

---

## 9) Persistencia Local e Contrato de API

### 9.1 MVP (ativo)
- Banco local SQLite para:
  - perfis por `exe_hash`
  - historico de resultado de sessao
  - flag de consentimento de telemetria (opt-in)

### 9.2 API comunitaria (preparada, nao bloqueante no MVP)
Endpoints previstos:
- `GET /profiles/{exe_hash}`
- `POST /profiles`
- `POST /telemetry/session-result`

Payload minimo sugerido:
- `exe_hash`
- `orchestrator_version`
- `distro_id`
- `kernel_version`
- `gpu_vendor`
- `result` (`perfect|playable|crash`)
- `duration_seconds`

Regras:
- Timeout curto (2-4s).
- Falha de rede nunca quebra fluxo do jogo.
- Retry/backoff apenas para fila de envio.
- Telemetria estritamente opt-in (default desabilitado).

---

## 10) Melhorias Aprovadas
1. Versionamento de schema (`config_version`).
2. Trailer robusto (`magic + len + sha256`).
3. Lock de instancia para evitar launch duplicado.
4. Logging estruturado por `exe_hash`.
5. Timeout nos subprocessos (`wineboot`, `winetricks`).
6. Fila offline para eventos/telemetria.
7. Sistema de pastas montadas com validacao de origem dentro da pasta do jogo.
8. Observabilidade AI-first com logs estruturados e pacote de diagnostico padronizado.

---

## 11) Plano de Implementacao (passo a passo)

### Fase 0 - Bootstrap
1. Criar workspace:
- `apps/creator-tauri`
- `crates/orchestrator-core`
- `bins/orchestrator`
2. Configurar frontend SolidJS + Vite.
3. Configurar CI basica (build/test).

### Fase 1 - Modelos e serializacao
1. Implementar structs Serde.
2. Implementar `RequirementsConfig` + validacoes de coerencia.
3. Testes de round-trip JSON.

### Fase 2 - Injector de payload
1. Copiar binario base.
2. Injetar JSON + trailer.
3. Garantir permissao executavel.
4. Testar extracao real no Orquestrador.

### Fase 3 - Parser self-read
1. Ler `current_exe`.
2. Extrair trailer e validar hash/tamanho.
3. Implementar `--show-config`.

### Fase 4 - Doctor e runtime discovery
1. Verificar dependencias no `PATH`.
2. Detectar Proton/Wine via env vars e paths comuns.
3. Implementar checagem de dependencias extras (`extra_system_dependencies`).
4. Implementar `ExecutionPlan` com status `OK/WARN/BLOCKER`.
5. Implementar `--doctor`.

### Fase 5 - Prefix setup
1. Resolver paths.
2. Criar prefix por hash se ausente.
3. Rodar `wineboot`, `winetricks`, import `.reg`.
4. Aplicar timeouts e diagnostico.
5. Implementar tradutor Windows->Unix para destino de montagem via `dosdevices`.
6. Implementar montagens por symlink com comportamento idempotente.

### Fase 6 - Launcher
1. Implementar state machine da splash minimalista.
2. Montar comando com wrappers na ordem definida.
3. Aplicar `folder_mounts` antes do pre-launch.
4. Executar `pre_launch`.
5. Implementar degradacao graciosa para itens em `OptionalOn`/`OptionalOff` ausentes.
6. Implementar regra de `Configurar` + contagem `3...2...1` apenas quando houver override permitido.
7. Spawn + wait.
8. Executar `post_launch`.
9. Lock de instancia.

### Fase 7 - UI App Criador (MVP local-first)
1. Wizard:
- selecionar `.exe`
- calcular hash
- salvar/consultar perfil local
- configurar opcoes de runtime/performance
- configurar politica de 4 estados por componente (`MandatoryOn`, `MandatoryOff`, `OptionalOn`, `OptionalOff`)
- configurar runtime `estrito` ou `com fallback`
- configurar `wine_wayland` e `hdr`
- configurar `auto_dxvk_nvapi`
- configurar `easy_anti_cheat_runtime` e `battleye_runtime`
- configurar `extra_system_dependencies` (comando/env/path padrao)
- configurar `wrapper_commands`
- configurar `environment.custom_vars`
- configurar opcoes de `winecfg` (dll overrides, mouse, janela, virtual desktop, drives, audio, staging)
- configurar `integrity_files` (arquivos obrigatorios)
- configurar "Pastas Montadas" com validacao em tempo real de path
2. Extrair icone com `wrestool/icotool` + conversao PNG.
3. Botao `Testar` para executar pipeline sem gerar binario e sem fechar janela.
4. Botao "Criar Executavel" com progresso e erros acionaveis.

### Fase 8 - Config UI do Orquestrador
1. `--config` com modal nativo leve.
2. Expor toggles apenas quando state for `OptionalOn` ou `OptionalOff`.
3. Reutilizar mesma UI no botao `Configurar` da splash pre-launch.

### Fase 9 - Resultados e telemetria opt-in
1. Modal final de avaliacao.
2. Persistir localmente.
3. Enviar remoto somente com consentimento.
4. Fila offline de envio.

### Fase 10 - QA e distribuicao
1. Testes em Fedora, Nobara e Pop!_OS.
2. Testes NVIDIA/AMD/Intel em X11 e Wayland.
3. Distribuicao primaria: AppImage.
4. Distribuicoes secundarias: rpm e deb.

### Fase 11 - Pos-MVP (fase 2/3)
1. Integracao completa com servidor comunitario.
2. Suporte dedicado a Steam Runtime/Flatpak.

### Fase 12 - Cross-cutting hardening
1. Implementar i18n ponta a ponta (App Criador + splash/CLI do Orquestrador).
2. Adicionar migracoes de schema/versionamento para perfis locais.
3. Implementar lock transacional por `exe_hash` para evitar setup concorrente de prefix.
4. Padronizar codigos de erro e export de bundle de diagnostico.
5. Assinatura/checksum de artefatos de distribuicao (AppImage/rpm/deb).

### Fase 13 - Execucao orientada por IA
1. Definir contratos estaveis (schemas JSON, codigos de erro, codigos de evento de log).
2. Fracionar backlog em tarefas atomicas (1 feature + testes + docs por PR).
3. Exigir evidencias machine-checkable por tarefa:
- testes automatizados
- logs de execucao
- artefatos JSON esperados
4. Bloquear merge com gate de qualidade:
- lint + test + snapshot i18n + validacao de schemas
5. Gerar changelog tecnico incremental por tarefa para permitir continuidade por outra IA sem perda de contexto.

---

## 12) Criterios de Aceite (MVP)
- Gera Orquestrador sem toolchain Rust no host final.
- Orquestrador le config embutida e inicia jogo corretamente.
- Splash minimalista exibe status de validacao, setup de prefix e launch.
- Prefix por hash funcional.
- `folder_mounts` funciona com multiplos mapeamentos.
- Origens fora da pasta do jogo sao bloqueadas com erro claro.
- App Criador permite definir politica de 4 estados por componente.
- `Doctor` produz `OK/WARN/BLOCKER` e respeita a politica salva.
- Itens em `OptionalOn`/`OptionalOff` ausentes degradam com fallback/desativacao sem quebrar launch.
- Violacoes de `MandatoryOn` bloqueiam launch com mensagem acionavel.
- Opcoes de compatibilidade (`wine_wayland`, `hdr`, `auto_dxvk_nvapi`, `EAC`, `BattleEye`, `staging`) respeitam a politica salva.
- Opcoes de `winecfg` sao aplicadas conforme politica salva.
- `--doctor`, `--verbose` e `--show-config` funcionais.
- `--lang` funcional no Orquestrador para override de idioma.
- Fallback Proton/Wine com descoberta por `PATH`/env vars/paths padrao.
- Se houver override permitido, splash mostra botao `Configurar` e contagem `3...2...1`.
- Se tudo estiver em `MandatoryOn`/`MandatoryOff`, launch ocorre sem botao `Configurar` e sem contagem.
- Feedback local funcional.
- Telemetria remota desativada por padrao (opt-in estrito).
- Interface com i18n funcional (minimo `pt-BR` e `en-US`) com fallback seguro para idioma padrao.
- Persistencia local com migracao de schema sem perda de perfil.
- Setup de prefix protegido por lock para evitar corrida entre duas instancias.
- Logs e erros com `error_code` e mensagem acionavel para suporte.
- Logs estruturados em NDJSON com `event_code`, `trace_id`, `span_id` e contexto suficiente para diagnostico por IA.
- Bundle de diagnostico exportavel com timeline, doctor report, execution plan e comandos executados (com redacao de segredos).

---

## 13) Decisoes Fechadas
1. Frontend: SolidJS.
2. Proton nao obrigatorio; fallback para Wine.
3. Download automatico de dependencias fora do MVP.
4. MVP local-first com banco local; API so preparada.
5. Telemetria estritamente opt-in.
6. `wrestool`/`icotool` permitidos como dependencia externa.
7. Scripts somente bash local do usuario.
8. Distribuicao: AppImage principal, rpm/deb secundarios.
9. Steam Runtime/Flatpak apenas fase 2/3.
10. CLI MVP inclui `--show-config`.
11. Recurso de "Pastas Montadas" entra no MVP com restricao de origem dentro da pasta do jogo.
12. Cada componente pode ser configurado com 4 estados (`MandatoryOn`, `MandatoryOff`, `OptionalOn`, `OptionalOff`).
13. Runtime suporta modo `estrito` ou `com fallback`.
14. App Criador inclui configuracoes de compatibilidade e `winecfg` no MVP.
15. MVP tera i18n com idiomas iniciais `pt-BR` e `en-US`.
16. Fallback de idioma sera automatico por: override CLI -> preferencia salva -> locale do sistema -> `en-US`.

---

## 14) Riscos Tecnicos e Mitigacoes

Riscos:
- Variabilidade de Proton fora do Steam por distro/versao.
- Diferencas entre Wayland e X11 para gamescope.
- Hosts sem dependencias externas (winetricks, zenity, icotool).
- Setup de prefix lento no primeiro launch.

Mitigacoes:
- `--doctor` com remediation objetiva.
- Fallback controlado entre Proton/Wine.
- Logs estruturados por jogo.
- Timeouts e mensagens de erro acionaveis.

---

## 15) Referencias Tecnicas (Heroic e Lutris)

Diretriz:
- Usar Heroic/Lutris como referencia tecnica de integracao (comandos, ordem de wrappers, env vars e prefix handling), sem copiar arquitetura/UX.

Padroes aproveitados para este projeto:
- Detectar binarios em `PATH` e falhar com erro acionavel (`mangohud`, `gamemoderun`, `gamescope`, `winetricks`).
- Avaliar disponibilidade antes do launch e decidir bloqueio vs degradacao por politica.
- Manter `gamescope` como wrapper externo principal e inserir `--` no final dos argumentos do wrapper.
- Tratar diferencas de versao do gamescope via inspeccao de `gamescope --help` (FSR antigo `-U` vs novo `-F fsr`).
- Suportar Proton com variaveis apropriadas (`PROTON_VERB`, `STEAM_COMPAT_APP_ID`, `GAMEID`) e fallback para Wine.
- Com UMU ativo, usar `umu-run`; sem UMU, cair para Proton direto com `PROTON_VERB`.
- Validar e bootstrapar prefixo com estrategia condicional (`createprefix` ou `wineboot --init`).
- Resolver mapeamentos de drive/pastas via `prefix/dosdevices` + symlink (modelo robusto para `folder_mounts`).
- Validar contencao de caminho com canonicalizacao e checagem de parent-child (incluindo symlink resolve).

Arquivos de referencia consultados:
- `Referencia/HeroicGamesLauncher-main/src/backend/launcher.ts`
- `Referencia/HeroicGamesLauncher-main/src/backend/utils/compatibility_layers.ts`
- `Referencia/HeroicGamesLauncher-main/src/backend/tools/index.ts`
- `Referencia/lutris-master/lutris/runner_interpreter.py`
- `Referencia/lutris-master/lutris/runners/commands/wine.py`
- `Referencia/lutris-master/lutris/util/wine/wine.py`
- `Referencia/lutris-master/lutris/util/wine/proton.py`
- `Referencia/lutris-master/lutris/util/wine/prefix.py`
- `Referencia/lutris-master/lutris/util/system.py`

---

## 16) Regras de Negocio (4 Estados por Componente)

No App Criador, cada jogo salva sua propria politica:
- `MandatoryOn`: o item deve estar ativo; ausencia bloqueia.
- `MandatoryOff`: o item deve ficar desativado; override nao permitido.
- `OptionalOn`: item ativo por padrao; usuario pode desligar.
- `OptionalOff`: item desativado por padrao; usuario pode ligar.

Regras por componente:
- Runtime:
  - se `strict=true`, so aceita `primary`.
  - se `strict=false`, usa `primary` e tenta `fallback_order`.
- UMU:
  - `MandatoryOn` e indisponivel: bloqueia.
  - `OptionalOn`/`OptionalOff`: cai para Proton nativo ou Wine (conforme politica).
  - `MandatoryOff`: nao usa UMU.
- Winetricks:
  - com `dependencies` vazias, pode ser ignorado.
  - com `dependencies` definidas:
    - `MandatoryOn`: sem winetricks, bloqueia setup.
    - `OptionalOn`/`OptionalOff`: pula setup de verbos e segue com aviso.
    - `MandatoryOff`: sempre pula setup.
- Gamescope/Gamemode/Mangohud:
  - `MandatoryOn`: ausencia bloqueia.
  - `OptionalOn`/`OptionalOff`: ausencia desativa wrapper e segue.
  - `MandatoryOff`: desativado sempre.
- Steam Runtime:
  - `MandatoryOn`: ausencia bloqueia quando requerido pelo plano.
  - `OptionalOn`/`OptionalOff`: ausencia desativa runtime e segue.
  - `MandatoryOff`: desativado sempre.
- Dependencias extras do sistema:
  - `MandatoryOn`: ausencia bloqueia.
  - `OptionalOn`/`OptionalOff`: ausencia gera `WARN`.
  - `MandatoryOff`: ignora verificacao.
- Arquivos obrigatorios (`integrity_files`):
  - qualquer item ausente bloqueia launch.
- Wrapper command:
  - `MandatoryOn`: sem comando resolvivel, bloqueia.
  - `OptionalOn`/`OptionalOff`: comando invalido gera `WARN` e e ignorado.
  - `MandatoryOff`: nao executa.
- Variaveis de ambiente:
  - aplicadas por ultimo, exceto chaves protegidas.
  - tentativa de sobrescrever chave protegida gera `WARN`.
- Winecfg:
  - `dll_overrides` validado por whitelist de modos.
  - opcoes de mouse/janela/desktop integration respeitam os 4 estados.
  - virtual desktop ativo exige resolucao valida.
  - drives devem ser letras unicas e origem dentro da pasta do jogo.
  - audio aceita apenas valores suportados (`pipewire`, `pulseaudio`, `alsa`).

Regras de UX:
- A splash sempre exibe o motivo de bloqueio ou degradacao.
- O usuario nao instala dependencias pela app no MVP; apenas recebe instrucao clara do que falta.

---

## 17) Abas do App Criador (UI limpa)

Regra de layout:
- Itens em lista vertical (um abaixo do outro).
- Cada item com icone `?` para tooltip detalhada.
- Tooltips explicam finalidade, impacto e quando usar `MandatoryOn`/`MandatoryOff`/`OptionalOn`/`OptionalOff`.

### Aba 1 - Jogo
- Nome do jogo
- Executavel principal (.exe)
- Pasta raiz do jogo (somente leitura)
- Hash SHA-256 (somente leitura + recalcular)
- Icone extraido (preview + reextrair)
- Argumentos de launch
- Arquivos obrigatorios do jogo (`integrity_files`)

### Aba 2 - Runtime
- Politica de runtime: `strict` ou fallback
- Runtime primario
- Ordem de fallback
- Versao Proton
- UMU (4 estados)
- Steam Runtime (4 estados)
- Easy AntiCheat Runtime (4 estados)
- BattleEye Runtime (4 estados)
- Dependencias extras do sistema (`extra_system_dependencies`)

### Aba 3 - Performance e Compatibilidade
- Gamescope (4 estados)
- Resolucao game/output + FSR
- Gamemode (4 estados)
- Mangohud (4 estados)
- Wine-Wayland (4 estados)
- HDR (4 estados, dependente de Wine-Wayland)
- Auto DXVK-NVAPI (4 estados)
- Staging (4 estados)
- Prime Offload

### Aba 4 - Prefixo e Dependencias
- Prefix path final (somente leitura)
- Winetricks (4 estados)
- Lista de verbos winetricks
- Chaves de registro
- Import de `.reg`
- Pastas montadas (`folder_mounts`)

### Aba 5 - Winecfg
- Substituicao de DLL (tabela: dll + modo)
- Capturar mouse automaticamente
- Permitir decoracao de janelas pelo WM
- Permitir controle de janelas pelo WM
- Emular desktop virtual + resolucao
- Integracao com area de trabalho
- Unidades (drives) com defaults e tabela editavel
- Audio (`pipewire`, `pulseaudio`, `alsa`)

### Aba 6 - Wrappers e Ambiente
- Wrapper commands (tabela: estado + executavel + args)
- Variaveis de ambiente (tabela chave/valor)
- Validacao de chaves protegidas

### Aba 7 - Scripts
- Script pre-launch (bash)
- Script post-launch (bash)
- Validacao basica

### Aba 8 - Revisao e Gerar
- Resumo de politicas (4 estados por item)
- Pre-doctor (OK/WARN/BLOCKER)
- Preview do JSON final
- Destino de saida
- Botao `Testar` (executa fluxo do Orquestrador sem gerar binario e sem fechar a janela)
- Botao `Criar Executavel`

---

## 18) Tabela de Configuracoes da UI (com ajuda)

Legenda:
- "Obrigatorio?" = obrigatorio para salvar perfil no App Criador.
- "Expert?" = se a opcao e voltada para usuario avancado.

### Aba 1 - Jogo
| Item | Tipo de componente do item | Texto de ajuda (tooltip) | Valor padrao (MVP) | Obrigatorio? | Expert? |
|---|---|---|---|---|---|
| Nome do jogo | `TextInput` | Nome exibido na splash e no banco local; nao afeta hash nem executavel do jogo. | vazio | Sim | Nao |
| Executavel principal (.exe) | `FilePicker` | Define o binario Windows principal; a partir dele a app calcula hash, pasta raiz e caminhos relativos. | vazio | Sim | Nao |
| Pasta raiz do jogo | `ReadOnlyPath` | Pasta-base usada para validar caminhos relativos; nenhum path fora dela e aceito para mounts/integridade. | auto (pai do `.exe`) | Sim | Nao |
| Hash SHA-256 | `ReadOnlyHash + ActionButton` | Identificador do perfil local e do prefixo; use "Recalcular" se o `.exe` for atualizado. | auto | Sim | Nao |
| Icone extraido | `Preview + ActionButton` | Extrai icone do `.exe` para preview da entrada; nao altera launch. | auto quando possivel | Nao | Nao |
| Argumentos de launch | `ListEditor` | Argumentos extras passados ao executavel do jogo no launch. | lista vazia | Nao | Nao |
| Arquivos obrigatorios do jogo (`integrity_files`) | `PathListEditor (relativo)` | Lista de arquivos que precisam existir na pasta do jogo antes do launch (ex.: DLLs obrigatorias). Falta de arquivo gera bloqueio. | lista vazia | Nao | Nao |

### Aba 2 - Runtime
| Item | Tipo de componente do item | Texto de ajuda (tooltip) | Valor padrao (MVP) | Obrigatorio? | Expert? |
|---|---|---|---|---|---|
| Politica de runtime (`strict`) | `Select` | `strict=true` aceita apenas runtime primario; `strict=false` permite fallback automatico. | `strict=false` | Sim | Nao |
| Runtime preferencial | `Select` | Prioridade geral entre `Auto`, `Proton` e `Wine`; influencia o plano inicial de execucao. | `Auto` | Sim | Nao |
| Runtime primario | `Select` | Primeiro candidato concreto (`ProtonUmu`, `ProtonNative` ou `Wine`). | `ProtonNative` | Sim | Nao |
| Ordem de fallback | `OrderedMultiSelect` | Candidatos usados quando o primario falha/nao existe e `strict=false`. | `ProtonUmu`, `Wine` | Sim | Nao |
| Versao Proton | `Select + Refresh` | Define a versao alvo do Proton quando o plano escolhe Proton. | melhor versao detectada | Sim | Nao |
| UMU | `FeatureStateSelect` | Controla uso de `umu-run`; em `MandatoryOn` ausente bloqueia launch. | `OptionalOn` | Sim | Nao |
| Steam Runtime | `FeatureStateSelect` | Encapsula launch com runtime Steam quando disponivel e permitido pela politica. | `OptionalOff` | Sim | Sim |
| Easy AntiCheat Runtime | `FeatureStateSelect` | Exige/permite runtime local de EAC; sem download automatico no MVP. | `OptionalOff` | Sim | Sim |
| BattleEye Runtime | `FeatureStateSelect` | Exige/permite runtime local de BattlEye; sem download automatico no MVP. | `OptionalOff` | Sim | Sim |
| Dependencias extras do sistema (`extra_system_dependencies`) | `TableEditor` | Dependencias adicionais verificadas por comando/env var/caminho padrao. `MandatoryOn` ausente bloqueia. | lista vazia | Nao | Sim |

### Aba 3 - Performance e Compatibilidade
| Item | Tipo de componente do item | Texto de ajuda (tooltip) | Valor padrao (MVP) | Obrigatorio? | Expert? |
|---|---|---|---|---|---|
| Gamescope | `FeatureStateSelect` | Executa jogo dentro do gamescope; recomendado quando necessario para composicao/upscaling. | `OptionalOff` | Sim | Nao |
| Resolucao (gamescope) | `ResolutionInput` | Resolucao de saida do gamescope; usada quando gamescope estiver ativo. | vazio | Nao | Nao |
| FSR (gamescope) | `Toggle` | Ativa upscaling FSR dentro do gamescope. | `false` | Nao | Sim |
| Gamemode | `FeatureStateSelect` | Usa `gamemoderun` para ajustes de performance no host. | `OptionalOn` | Sim | Nao |
| MangoHud | `FeatureStateSelect` | Overlay de metricas; com gamescope pode virar `--mangoapp`. | `OptionalOff` | Sim | Nao |
| Wine-Wayland | `FeatureStateSelect` | Forca backend Wayland no Wine quando suportado pelo runtime. | `OptionalOff` | Sim | Sim |
| HDR | `FeatureStateSelect` | HDR no pipeline Wayland; exige Wine-Wayland ativo e suporte do host/runtime. | `OptionalOff` | Sim | Sim |
| Auto DXVK-NVAPI | `FeatureStateSelect` | Habilita ajuste automatico de DXVK-NVAPI quando suportado pelo runtime. | `OptionalOff` | Sim | Sim |
| Staging | `FeatureStateSelect` | Requer build Wine/runner com staging quando ligado. | `OptionalOff` | Sim | Sim |
| Prime Offload | `Toggle` | Exporta variaveis de offload para GPU dedicada em notebooks hibridos. | `false` | Nao | Sim |

### Aba 4 - Prefixo e Dependencias
| Item | Tipo de componente do item | Texto de ajuda (tooltip) | Valor padrao (MVP) | Obrigatorio? | Expert? |
|---|---|---|---|---|---|
| Prefix path final | `ReadOnlyPath` | Caminho final calculado por hash (`~/.local/share/GameOrchestrator/prefixes/<exe_hash>`). | auto | Sim | Nao |
| Winetricks | `FeatureStateSelect` | Define se verbos winetricks sao obrigatorios/opcionais/desativados. | `OptionalOn` quando ha verbos, senao `OptionalOff` | Sim | Nao |
| Lista de verbos winetricks (`dependencies`) | `TagListEditor` | Verbos aplicados no setup inicial do prefixo (ex.: `corefonts`, `vcrun2005`). | lista vazia | Nao | Sim |
| Chaves de registro | `TableEditor` | Entradas de registro aplicadas no prefixo apos boot inicial. | lista vazia | Nao | Sim |
| Import de `.reg` | `FilePicker` | Importa um arquivo `.reg` local para aplicar no prefixo. | vazio | Nao | Sim |
| Pastas montadas (`folder_mounts`) | `TableEditor` | Mapeia pasta relativa do jogo para destino Windows no prefixo (`dosdevices`). Origem fora da pasta do jogo e bloqueada. | lista vazia | Nao | Sim |

### Aba 5 - Winecfg
| Item | Tipo de componente do item | Texto de ajuda (tooltip) | Valor padrao (MVP) | Obrigatorio? | Expert? |
|---|---|---|---|---|---|
| Substituicao de DLL | `TableEditor` | Regras de override por DLL (`builtin/native/...`) aplicadas no prefixo. | lista vazia | Nao | Sim |
| Capturar mouse automaticamente | `FeatureStateSelect` | Controla comportamento de captura de mouse do Wine para reduzir perda de foco. | `OptionalOn` | Sim | Sim |
| Permitir decoracao de janelas pelo WM | `FeatureStateSelect` | Delega decoracao da janela ao window manager do host. | `OptionalOn` | Sim | Sim |
| Permitir controle de janelas pelo WM | `FeatureStateSelect` | Permite ao WM mover/redimensionar janelas do Wine. | `OptionalOn` | Sim | Sim |
| Emular desktop virtual | `FeatureStateSelect + ResolutionInput` | Executa jogo dentro de desktop virtual Wine; resolucao obrigatoria quando ativo. | `OptionalOff` | Sim | Sim |
| Integracao com area de trabalho | `FeatureStateSelect` | Ajusta integracao de janelas do Wine com desktop do host. | `OptionalOn` | Sim | Sim |
| Unidades (drives) | `TableEditor` | Mapeia letras de unidade para caminhos relativos do jogo; `C:` interno fixo, `Z:` opcional por padrao. | `C:` fixo + `Z:` `OptionalOn` | Sim | Sim |
| Audio | `Select` | Driver preferencial de audio no Wine (`pipewire`, `pulseaudio`, `alsa`) ou automatico. | `auto` | Nao | Sim |

### Aba 6 - Wrappers e Ambiente
| Item | Tipo de componente do item | Texto de ajuda (tooltip) | Valor padrao (MVP) | Obrigatorio? | Expert? |
|---|---|---|---|---|---|
| Wrapper commands | `TableEditor` | Wrappers customizados em cadeia (estado + executavel + args), sem expansao shell implicita. | lista vazia | Nao | Sim |
| Variaveis de ambiente (`custom_vars`) | `TableEditor` | Env vars extras aplicadas no launch, com bloqueio de chaves protegidas. | lista vazia | Nao | Sim |
| Validacao de chaves protegidas | `StaticRule` | Impede sobrescrever `WINEPREFIX` e `PROTON_VERB`. | sempre ativo | Sim | Nao |

### Aba 7 - Scripts
| Item | Tipo de componente do item | Texto de ajuda (tooltip) | Valor padrao (MVP) | Obrigatorio? | Expert? |
|---|---|---|---|---|---|
| Script pre-launch | `CodeEditor (bash)` | Script bash local executado antes do launch do jogo. | vazio | Nao | Sim |
| Script post-launch | `CodeEditor (bash)` | Script bash local executado apos o termino do jogo. | vazio | Nao | Sim |
| Validacao basica | `InlineValidator` | Checa sintaxe basica e bloqueia script vazio com estado `MandatoryOn` quando aplicavel. | sempre ativa | Sim | Nao |

### Aba 8 - Revisao e Gerar
| Item | Tipo de componente do item | Texto de ajuda (tooltip) | Valor padrao (MVP) | Obrigatorio? | Expert? |
|---|---|---|---|---|---|
| Resumo de politicas | `ReadOnlySummary` | Consolida todos os componentes e seus 4 estados antes da execucao/geracao. | auto | Sim | Nao |
| Pre-doctor | `ActionButton + ResultPanel` | Executa validacao rapida de dependencias e mostra `OK/WARN/BLOCKER` sem gerar arquivo. | manual | Nao | Nao |
| Preview do JSON final | `ReadOnlyJsonViewer` | Exibe payload final que sera embutido no binario. | auto | Sim | Sim |
| Destino de saida | `PathPicker` | Define onde salvar o orquestrador gerado (default: pasta do jogo). | pasta do jogo | Sim | Nao |
| Botao `Testar` | `ActionButton` | Executa o mesmo pipeline do Orquestrador (doctor/setup/launch dry-run controlado) sem gerar binario e sem fechar a App Criador. | disponivel | Nao | Nao |
| Botao `Criar Executavel` | `PrimaryActionButton` | Copia binario base, injeta payload versionado e marca permissao de execucao. | disponivel | Sim | Nao |

---

## 19) Internacionalizacao (i18n/l10n)

### 19.1 Escopo
- Aplicar i18n em:
  - App Criador (todas as abas, tooltips, validacoes e mensagens de erro).
  - Splash/menus nativos do Orquestrador.
  - CLI (`--help`, `--doctor`, `--show-config` quando exibicao amigavel for usada).
- Idiomas iniciais do MVP: `pt-BR` e `en-US`.

### 19.2 Politica de resolucao de idioma
Ordem de resolucao:
1. `--lang <locale>` (sessao atual, Orquestrador/CLI).
2. Preferencia salva em `AppSettings.preferred_locale`.
3. Locale do sistema (`LANG`, `LC_ALL`, `LC_MESSAGES`).
4. Fallback final: `en-US`.

### 19.3 Regras de implementacao
- Dicionarios por chave estavel (nao usar texto literal hardcoded em fluxo de negocio).
- Namespaces sugeridos:
  - `common`
  - `tabs`
  - `tooltips`
  - `doctor`
  - `errors`
  - `splash`
- Mensagens com placeholders devem usar interpolacao nomeada.
- Pluralizacao deve respeitar regras do locale.
- Nao localizar:
  - chaves JSON (`GameConfig`)
  - nomes de env vars
  - codigos de erro (`error_code`)
  - nomes tecnicos de comandos/binarios

### 19.4 Qualidade de i18n
- Build deve falhar em chave obrigatoria ausente para locale default.
- Locale secundario pode faltar chave, mas deve cair em fallback sem crash.
- Testes de snapshot para telas principais em `pt-BR` e `en-US`.

---

## 20) Itens Criticos Adicionais (arquitetura)

### 20.1 Seguranca e confianca
- Verificar hash/checksum do binario base antes de injetar payload.
- Recusar execucao se o trailer embutido falhar em validacao de integridade.
- Nao usar `sh -c` para wrappers/dependencias; sempre vetor de argumentos.
- Scripts bash rodam no contexto do usuario (sem root), com timeout e log dedicado.

### 20.2 Integridade e recuperacao
- Escrita atomica ao gerar Orquestrador (arquivo temporario + rename).
- Backup `.bak` do orquestrador anterior antes de sobrescrever.
- Migracoes versionadas para banco local e perfis.
- Checkpoints de setup do prefix para retomar fluxo apos falha sem corromper estado.

### 20.3 Concorrencia e locking
- Lock por `exe_hash` para impedir duas instancias configurando o mesmo prefix simultaneamente.
- Lock global leve para evitar geracao concorrente do mesmo arquivo de saida.
- Tempo maximo de lock com expiracao segura e release em crash.

### 20.4 Diagnostico e suporte
- Catalogo de erros com `error_code` estavel + mensagem traduzida.
- Export de bundle de diagnostico com:
  - versao app/orquestrador
  - distro/kernel
  - runtime detectado
  - ultimos logs da sessao
- Redacao automatica de dados sensiveis em logs (`HOME`, usuario, paths privados quando possivel).

### 20.5 Acessibilidade (A11y)
- Navegacao completa por teclado nas abas/formularios da App Criador.
- Tooltips com alternativa acessivel (focus + leitura por screen reader).
- Contraste minimo AA para textos de status da splash.
- Nao depender apenas de cor para estados `OK/WARN/BLOCKER`.

### 20.6 Estrategia de testes e release
- Testes unitarios para parser de trailer e construtor de comandos.
- Testes de integracao para doctor/discovery (com mocks de PATH/env).
- Testes de regressao para `folder_mounts` e validacao de contencao de path.
- Pipeline de release com checksum e assinatura dos artefatos distribuiveis.

---

## 21) Observabilidade e Logs AI-first

Objetivo:
- Tornar cada execucao rastreavel por humanos e por IA sem adivinhacao.

### 21.1 Formato de log
- Formato padrao: NDJSON (uma linha JSON por evento).
- Campos obrigatorios por evento:
  - `ts` (RFC3339 com milissegundos)
  - `level` (`TRACE|DEBUG|INFO|WARN|ERROR`)
  - `event_code` (codigo estavel)
  - `message` (curta, legivel)
  - `trace_id` (id da sessao)
  - `span_id` (id da etapa)
  - `exe_hash`
  - `component` (`creator|orchestrator|doctor|launcher|prefix|ui`)
  - `context` (objeto JSON com chaves estaveis)

Exemplo:
```json
{"ts":"2026-02-24T21:10:32.104Z","level":"INFO","event_code":"GO-DR-002","message":"runtime_detected","trace_id":"6f1a...","span_id":"doctor-runtime","exe_hash":"a1b2...","component":"doctor","context":{"candidate":"ProtonNative","path_source":"PATH","resolved":true}}
```

### 21.2 Taxonomia de codigos
- Prefixos:
  - `GO-CFG-*` (parse/config)
  - `GO-DR-*` (doctor/discovery)
  - `GO-PF-*` (prefix setup)
  - `GO-LN-*` (launch)
  - `GO-SC-*` (scripts)
  - `GO-UI-*` (UI/splash)
  - `GO-ER-*` (erros finais)
- Cada codigo deve ter:
  - descricao
  - causa provavel
  - acao recomendada
  - severidade padrao

### 21.3 Tracing de comandos externos
- Para cada comando executado, logar:
  - `argv` (vetor, sem shell join)
  - `cwd`
  - `env_diff` (somente variaveis relevantes)
  - `timeout_ms`
  - `exit_code`
  - `duration_ms`
- Nunca logar segredos em texto puro.

### 21.4 Artefatos de diagnostico (bundle)
- Gerar pacote opcional contendo:
  - `timeline.ndjson`
  - `doctor_report.json`
  - `execution_plan.json`
  - `config_embedded_sanitized.json`
  - `commands_trace.json`
  - `system_snapshot.json`
- Bundle deve ser zipavel e reutilizavel por IA para reproduzir raciocinio de debug.

### 21.5 Redacao e privacidade
- Redigir automaticamente:
  - usuario/home
  - tokens/chaves/credenciais
  - paths pessoais fora da pasta do jogo (quando possivel)
- Regra: log util > log verboso; priorizar sinal sobre ruido.

### 21.6 Politica de retencao
- Rotacao por tamanho e por quantidade de arquivos.
- Perfil de log:
  - `normal` (padrao)
  - `debug`
  - `trace` (ativado por CLI ou UI para troubleshooting)

---

## 22) Roadmap Otimizado para IA (implementacao)

Observacao:
- O roadmap da secao 11 e bom para planejamento humano.
- Para IA, o ideal e pipeline incremental com contratos fixos e verificacao automatica por etapa.

### 22.1 Principios
- Tarefas pequenas e independentes (baixo acoplamento).
- Cada tarefa entrega:
  - codigo
  - teste automatizado
  - atualizacao de docs/contexto
  - evidencia de execucao (logs/artefatos)
- Evitar tarefas ambiguuas sem criterio de pronto objetivo.

### 22.2 Sequencia AI-first
1. Congelar contratos:
- schemas (`GameConfig`, `AppSettings`, log event schema)
- codigos de erro
- codigos de evento

2. Base de qualidade:
- CI com lint, testes, validacao de schema, snapshot i18n
- fixtures de teste para doctor/launch/prefix

3. Implementacao por fatias verticais:
- F1: injector + self-read + `--show-config`
- F2: doctor/discovery + `ExecutionPlan`
- F3: prefix setup idempotente + mounts
- F4: launch pipeline + splash + `--config`
- F5: App Criador por abas + validacoes + botao `Testar`
- F6: observabilidade completa + bundle de diagnostico

4. Hardening:
- locking, migracoes, escrita atomica, backup, redacao de logs

5. Release:
- matriz de testes por distro/GPU/session (X11/Wayland)
- assinatura/checksum

### 22.3 Definicao de pronto por tarefa (DoD para IA)
- Testes relevantes passam localmente.
- Novos `event_code` documentados.
- Sem regressao em schemas.
- Sem TODOs criticos no diff.
- Mudanca reproduzivel com comando unico de validacao.

---

## 23) Todo
- Melhorar pasta raiz do jogo
- Melhorar versão do proton
- ordem de fallback runtime

## 24) Progresso de Implementacao (checkpoint)

### 2026-02-24 - Checkpoint 01
Escopo implementado:
- Bootstrap do workspace Rust:
  - `Cargo.toml` raiz com membros:
    - `crates/orchestrator-core`
    - `bins/orchestrator`
- `orchestrator-core` criado com:
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
  - placeholder `apps/creator-tauri/README.md`.

Bloqueio observado no ambiente desta sessao:
- `cargo test` nao concluiu por indisponibilidade de rede para baixar crates (`index.crates.io`).

Proximo checkpoint planejado:
- Implementar Fase 2 no App Criador (injeção de payload no binario base).
- Adicionar comando de teste local no App Criador usando o mesmo pipeline do Orquestrador sem gerar arquivo final.

### 2026-02-24 - Checkpoint 02
Escopo implementado:
- Fase 2 (parcial) entregue via utilitario CLI e modulo core:
  - novo modulo `injector` em `orchestrator-core`;
  - injeção de payload com:
    - validacao de `GameConfig` antes de embutir;
    - escrita atomica (tmp + rename);
    - backup `.bak` quando output ja existe;
    - marca de executavel (Unix);
    - verificacao pos-injecao comparando payload extraido.
- Novo binario `orchestrator-injector` para uso pelo App Criador:
  - `--base`, `--config`, `--output`, `--no-backup`, `--no-exec-bit`.
- Testes unitarios adicionados no modulo `injector` (roundtrip + backup).

Proximo checkpoint planejado:
- Integrar `injector` ao backend Tauri (command `create_orchestrator_binary`).
- Comecar Fase 4 (`doctor/discovery`) no binario `orchestrator`.

### 2026-02-24 - Checkpoint 03
Escopo implementado:
- Fase 4 (parcial) no `orchestrator`:
  - `--doctor` agora funcional, com relatorio JSON.
- Novo modulo `doctor` em `orchestrator-core` com:
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
- Integrar comando de injeção no backend Tauri do App Criador.

### 2026-02-24 - Checkpoint 04
Escopo implementado:
- Fase 5 (parcial) no `orchestrator-core`:
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
- Novo crate `creator-core` para backend local do App Criador:
  - `create_orchestrator_binary(...)` usando `inject_from_parts(...)`;
  - `sha256_file(...)` para hash de executavel;
  - validacao de paths relativos no payload (`relative_exe_path`, `integrity_files`, `folder_mounts`);
  - helper para normalizar caminho relativo dentro da pasta do jogo.
- `orchestrator-core::injector` atualizado com API de injeção por bytes (`inject_from_parts`) para evitar depender de arquivo temporario de config.

Proximo checkpoint planejado:
- Integrar `creator-core` ao backend Tauri (`src-tauri`) com comandos de alto nivel para UI.
- Executar `PrefixSetupPlan` de forma real no Orquestrador com logs por etapa.

### 2026-02-24 - Checkpoint 06
Escopo implementado:
- Backend inicial do App Criador em `apps/creator-tauri/src-tauri`:
  - funcao `create_executable(...)`:
    - recebe JSON de config;
    - desserializa para `GameConfig`;
    - chama `creator-core` para gerar o orquestrador.
  - funcao `hash_executable(...)` para SHA-256 do executavel alvo.
- Arquitetura isolada:
  - regra de negocio continua em crates (`creator-core` + `orchestrator-core`);
  - `src-tauri` atua como camada de adaptacao para futura exposicao de `#[tauri::command]`.

Proximo checkpoint planejado:
- Adicionar comandos Tauri reais no backend (`#[tauri::command]`) e conectar ao frontend.
- Implementar execucao real do `PrefixSetupPlan` no fluxo `--play` do Orquestrador.

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
  - `GAME_ORCH_DRY_RUN=1` executa fluxo sem spawn real.

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
  - dry-run global por `GAME_ORCH_DRY_RUN=1`.
- Logs adicionais por etapa para depuracao humana/IA.

Proximo checkpoint planejado:
- Expor comandos Tauri reais (`#[tauri::command]`) no backend do App Criador.
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
- Frontend mínimo do App Criador criado em `apps/creator-tauri`:
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
- Novo utilitario `creator-cli` para testes via terminal:
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
- Orquestrador (`--play`) reforcado com validacao defensiva de paths:
  - bloqueia path absoluto Linux/Windows e traversal (`..`) inclusive com `\`;
  - mesma regra aplicada em validacao de integridade e resolucao do exe.
- `--config` deixou de ser placeholder:
  - agora gerencia overrides opcionais por jogo para `mangohud`, `gamescope`, `gamemode`;
  - suporte a `--set-mangohud`, `--set-gamescope`, `--set-gamemode`;
  - overrides persistidos em `~/.local/share/GameOrchestrator/overrides/<exe_hash>.json`;
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
- Integracao de `folder_mounts` no fluxo real do Orquestrador (`--play`), antes do pre-launch:
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
- `cargo test -p orchestrator -- --nocapture`
- `cargo build --workspace`
- `cargo clippy -p orchestrator --all-targets -- -D warnings`

### 2026-02-24 - Checkpoint 19
Escopo implementado:
- Hardening de validacao no `creator-core` (antes de gerar o binario):
  - paths relativos agora sao validados de forma lexical e cross-platform:
    - bloqueia vazio;
    - bloqueia absolutos Linux (`/`) e Windows (`C:\...`);
    - bloqueia traversal com `/..` e `\..`.
  - validacao de `folder_mounts.target_windows_path` no App Criador:
    - exige formato `X:\...`;
    - bloqueia `%ENV%`, UNC (`\\server\share`) e traversal;
    - normaliza e detecta destinos duplicados (case-insensitive).
- `to_relative_inside_game_root` agora retorna path normalizado em formato unix-like.
- Novas variantes de erro em `CreatorError` para falhas de mount target e path invalido.
- Testes adicionados para:
  - absoluto Windows em path relativo;
  - traversal com backslash;
  - mount target invalido;
  - mount target duplicado;
  - normalizacao de path com backslash.

Validacao do checkpoint:
- `cargo fmt --all`
- `cargo test -p creator-core -- --nocapture`
- `cargo build --workspace`
- `cargo clippy -p creator-core --all-targets -- -D warnings`

### 2026-02-24 - Checkpoint 18
Escopo implementado:
- Lock de instancia por jogo (`exe_hash`) no Orquestrador:
  - lock file em `~/.local/share/GameOrchestrator/locks/<exe_hash>.lock`;
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
- `cargo test -p orchestrator -- --nocapture`
- `cargo build --workspace`
- `cargo clippy -p orchestrator --all-targets -- -D warnings`

### 2026-02-24 - Checkpoint 20
Escopo implementado:
- App Criador (frontend Solid) recebeu refatoracao visual completa com componentes reutilizaveis:
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
- Correcoes de UX no App Criador (frontend):
  - campo de executavel com `file picker` real;
  - `Import .reg` com `file picker`;
  - `folder_mounts.source_relative_path` com `folder picker` (com validacao para pasta dentro de `game_root`);
  - `Orchestrator base` tornou-se fixo/read-only (nao editavel pela UI).
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
- Backend local App Criador:
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
- `cargo test -p creator-tauri-backend -- --nocapture`
- `cargo build --workspace`

### 2026-02-24 - Checkpoint 22
Escopo implementado:
- Pickers com fallback para modo browser (sem runtime Tauri):
  - `pickFile` e `pickFolder` tentam dialog nativo Tauri;
  - se Tauri nao estiver disponivel (ex.: `npm run dev` web), usam fallback via `<input type=\"file\">`.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise x node@lts -- npm run build` (frontend)
- `cargo test -p creator-tauri-backend -- --nocapture`

### 2026-02-24 - Checkpoint 23
Escopo implementado:
- Pipeline de build desktop do App Criador consolidado:
  - `src-tauri/build.rs` adicionado com `tauri_build::build()`;
  - `tauri-build` em `build-dependencies`;
  - `tauri.conf.json` com `beforeDevCommand`/`beforeBuildCommand` e bundle ativo.
- Comandos Tauri reorganizados para evitar conflito de macro em release:
  - wrappers `#[tauri::command]` movidos para `src-tauri/src/main.rs`;
  - `src-tauri/src/lib.rs` mantido como camada pura de logica.
- Preparacao automatica de compatibilidade Linux para Tauri v1 em distros com WebKit 4.1:
  - script `apps/creator-tauri/scripts/prepare-linux-compat.sh`;
  - gera `pkgconfig/*-4.0.pc` apontando para libs 4.1;
  - gera `libshims/libwebkit2gtk-4.0.so` e `libshims/libjavascriptcoregtk-4.0.so`.
- Scripts NPM atualizados:
  - `tauri:dev` e `tauri:build` executam o script de compatibilidade antes do build;
  - `tauri:build` usa `-b none` para gerar binario nativo sem depender do bundler AppImage;
  - `tauri:bundle` mantido separado para empacotamento completo.
- Icone minimo RGBA adicionado em `src-tauri/icons/icon.png` para satisfazer o `generate_context`.
- Observacao de ambiente (Arch/CachyOS): bundling AppImage falha por limitacao do `strip` do `linuxdeploy` com binarios RELR; build de binario nativo funciona.

Resultado operacional:
- Binario desktop do Creator gerado em:
  - `target/release/game-orchestrator-creator`

Validacao do checkpoint:
- `npm run tauri:build` (com `mise`, gerando binario release)
- `cargo test -p creator-tauri-backend -- --nocapture`

### 2026-02-24 - Checkpoint 24
Escopo implementado:
- Refatoracao completa de UX visual do App Criador (frontend):
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
- `cargo test -p creator-tauri-backend -- --nocapture`

### 2026-02-24 - Checkpoint 25
Escopo implementado:
- Redesign estrutural completo da interface do Creator:
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
- `cargo test -p creator-tauri-backend -- --nocapture`

### 2026-02-24 - Checkpoint 26
Escopo implementado:
- Reescrita do frontend para base shadcn com separacao de responsabilidades:
  - `App.tsx` virou entrypoint minimo;
  - nova camada `features/creator/useCreatorController.ts` concentra estado, efeitos, comandos Tauri e regras de negocio da UI;
  - `features/creator/CreatorPage.tsx` ficou focada em renderizacao.
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

### 2026-02-24 - Checkpoint 56
Escopo implementado:
- Aba `Wrappers e Ambiente` renomeada para `Execução e Ambiente` e consolidada:
  - conteudo de `Scripts` foi movido para a mesma aba;
  - aba `Scripts` removida da navegacao lateral e da ordem de tabs do Creator (compatibilidade visual mantida).
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
- Itens de listas do Creator migrados de "cards/linhas soltas" para tabelas simples com cabecalho (melhor legibilidade de colunas):
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
- Reestruturacao da aba `winecfg` (Creator):
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

- Orquestrador CLI:
  - adicionado parametro `--winecfg`;
  - fluxo executa `Doctor`, setup de prefixo (se necessario) e abre `winecfg` no runtime selecionado;
  - gera saida JSON com plano/comando/resultados (seguindo padrao dos outros comandos).

Observacao de implementacao:
- Varias opcoes de `winecfg` ainda sao tratadas como payload/UI e schema (MVP visual/contrato). Aplicacao detalhada dessas chaves no setup real do prefixo permanece fase seguinte.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)
- `/home/rafael/.cargo/bin/cargo build --workspace`

### 2026-02-24 - Checkpoint 55
Escopo implementado:
- Feedback global da UI do Creator migrado de banner fixo para `Sonner`:
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
  - `Obrigatorio` continua independente e preserva o papel de expor/bloquear edicao futura no launcher/config do orquestrador;
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
- Novo `FeatureStateField` (UI do App Criador):
  - substitui selects de `FeatureState` por dois cards clicaveis (`Ativado` e `Obrigatorio`) no lado direito do item;
  - cada card alterna um bit da semantica (`enabled` e `mandatory`) e preserva o outro;
  - mapeamento bidirecional mantido para o enum de payload:
    - `MandatoryOn`, `MandatoryOff`, `OptionalOn`, `OptionalOff`.
- Aplicado aos itens de `FeatureState` nas abas (Runtime, Performance/Compatibilidade e Winecfg) que usavam `SelectField<FeatureState>`.

Observacao de backend:
- Nao houve mudanca de schema/payload. A UI apenas passou a editar os mesmos 4 estados por meio de dois toggles (`Ativado` + `Obrigatorio`), preservando a logica de execucao do orquestrador.

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
- `environment.prime_offload` em `orchestrator-core` mudou de `bool` para `FeatureState`.
- Mantida compatibilidade com configs antigos:
  - o parser aceita tanto `bool` quanto `FeatureState` para `prime_offload`;
  - `true` antigo vira `OptionalOn`;
  - `false` antigo vira `OptionalOff`.
- `launch` do orquestrador passou a aplicar variaveis de PRIME offload quando `prime_offload` estiver em estado ligado (`MandatoryOn`/`OptionalOn`).

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

Testes adicionados (creator-tauri-backend):
- parse de `hex(7)` multiline
- parse de `DWORD:` case-insensitive
- warning em hex inválido com manutenção da entrada

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)
- `/home/rafael/.cargo/bin/cargo test -p creator-tauri-backend -- --nocapture`

### 2026-02-24 - Checkpoint 54
Escopo implementado:
- Adicionados scripts de conveniencia na raiz do repositorio para evitar comandos manuais repetitivos:
  - `build-creator-e-abrir.sh`
    - compila o Creator via `npm run tauri:build`;
    - ao final abre a pasta `apps/creator-tauri/src-tauri/target/release` no gerenciador de arquivos;
    - lista executaveis encontrados na pasta `release`.
  - `rodar-frontend-lan.sh`
    - sobe o frontend Vite exposto na rede (`0.0.0.0`, porta padrao `1420`);
    - imprime URL local e URL LAN (IP da maquina);
    - verifica conflito de porta e informa processo ocupando a porta quando possivel.
- Ambos:
  - detectam `mise` automaticamente (PATH ou `~/.local/bin/mise`);
  - adicionam `~/.cargo/bin` ao `PATH`;
  - executam `npm install` automaticamente se `node_modules` nao existir.

Validacao do checkpoint:
- `bash -n ./build-creator-e-abrir.sh ./rodar-frontend-lan.sh`
- `/home/rafael/.cargo/bin/cargo test -p creator-tauri-backend -- --nocapture`

### 2026-02-24 - Checkpoint 27
Escopo implementado:
- Tema visual do Creator migrado para dark mode inspirado no shadcn:
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
- Sidebar do Creator atualizada para estilo semelhante ao exemplo shadcn:
  - novo `features/creator/AppSidebar.tsx` com icones Tabler e navegacao por abas.
- `FormControls` refatorado para layout em 3 partes:
  - esquerda (titulo/descricao), direita (controle/acao), baixo (linhas, quando aplicavel);
  - `StringListField` e `KeyValueListField` migrados para fluxo “botao -> dialog -> linha adicionada abaixo com remover”.
- Migracoes de itens para fluxo de dialog + linhas:
  - `Hash SHA-256` (campo + acao no mesmo item);
  - `Prefix path final` (campo + acao de copiar no mesmo item);
  - `registry_keys`, `folder_mounts`, `dll_overrides`, `wrapper_commands` agora adicionados via `Dialog` e renderizados em linhas no rodape do item com icone de exclusao.
- Suporte adicional:
  - `@tabler/icons-solidjs` adicionado para icones de sidebar e acoes de lista;
  - `useCreatorController` ganhou helper `pickMountSourceRelative` para uso em dialog de montagem.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)
- `/home/rafael/.cargo/bin/cargo test -p creator-tauri-backend -- --nocapture`

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
  - toggle de tema adicionado ao lado do seletor de idioma no header do Creator;
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
  - `useCreatorController` ganhou helpers para override de pasta raiz e seleção de arquivo obrigatório relativo.

Validacao do checkpoint:
- `/home/rafael/.local/bin/mise exec -- npm run build` (frontend)

### 2026-02-24 - Checkpoint 33
Escopo implementado:
- UX do dialog de `StringListField` com picker opcional melhorada:
  - quando existe `onPickValue`, o dialog agora mostra `input + botão` na mesma linha (em vez de botão solto abaixo);
  - fluxo ficou mais consistente com os demais itens `campo + ação`.
- Aplicado diretamente ao caso de `Arquivos obrigatórios (integrity_files)`.

Observacao de arquitetura:
- `input type=file` nativo nao foi adotado como fonte principal nesses casos porque o Creator precisa de caminho real/absoluto (Tauri dialog) para calcular/validar caminhos relativos com confianca. O fallback web continua existindo via `pickFile`.

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
