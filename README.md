# Luthier

Luthier é um app desktop Linux para criar lançadores nativos de jogos Windows.

Ele gera um executável Linux ao lado do `.exe` do jogo. Esse executável (internamente chamado de **Luthier Orchestrator**) carrega uma configuração embutida, valida o ambiente, prepara runtime/prefixo e executa o jogo com Wine/Proton e recursos opcionais (Gamescope, MangoHud, GameMode, entre outros).

## Por que isso é importante

- Padroniza o setup de execução no Linux sem depender de “tutorial manual” por jogo.
- Diminui suporte repetitivo (dependências, runtime, ajustes de compatibilidade).
- Entrega um launcher portátil com diagnóstico (`--doctor`) e execução assistida (`--play` / splash).

## Para quem é

- Pessoas/equipes que distribuem jogos ou mods para Linux com Wine/Proton.
- Usuários avançados que querem encapsular configurações de execução em um launcher único.

## Como instalar

## Opção A: usar release pronta (recomendado para usuário final)

Quando houver release publicada, baixe o pacote em **Releases** do GitHub e instale normalmente no Linux.

## Opção B: rodar/buildar a partir do código-fonte

Pré-requisitos (Linux):
- Rust (`cargo`, `rustc`)
- Node.js 20+
- npm
- Pacotes de GUI/WebKit/GTK para Tauri (varia por distro)

Executar o app desktop em modo desenvolvimento:

```bash
cd apps/luthier
npm install
npm run tauri:dev
```

Gerar build desktop:

```bash
cd apps/luthier
npm run tauri:bundle
```

## Como usar (visão rápida)

1. Abra o Luthier.
2. Selecione o executável Windows do jogo (`.exe`) e complete os campos principais.
3. Ajuste compatibilidade/runtime/winecfg conforme necessário.
4. Gere o launcher nativo Linux.
5. Distribua/use o launcher gerado junto do jogo.

## Uso do launcher gerado (Orchestrator)

Exemplos úteis:

```bash
./meu-jogo --doctor
./meu-jogo --play
./meu-jogo --play-splash
./meu-jogo --winecfg
./meu-jogo --show-payload
./meu-jogo --save-payload
./meu-jogo --set-mangohud on --set-gamescope off --play
```

Observações importantes:
- O modo antigo `--config` foi removido.
- Overrides de runtime/compatibilidade agora são feitos por flags `--set-<feature> on|off|default`.

## Estado atual do projeto

Fluxo ponta a ponta já funcional:
- criação de perfil no app
- geração de launcher com payload embutido
- diagnóstico de ambiente (`--doctor`)
- execução com e sem splash (`--play`, `--play-splash`)
- fluxo de `winecfg` (`--winecfg`)

Backlog funcional e débitos técnicos: [docs/planning/debito.md](./docs/planning/debito.md)

## Estrutura do repositório

```text
apps/luthier/                    # App desktop (Tauri + SolidJS)
bins/luthier-orchestrator/       # Runtime do launcher gerado
bins/luthier-cli/                # CLI de apoio local
bins/luthier-orchestrator-injector/
crates/luthier-core/
crates/luthier-orchestrator-core/
scripts/                         # Gates de qualidade e scripts de suporte
.github/workflows/ci.yml         # CI
docs/planning/                   # Planejamento e backlog funcional
```

## Fluxo de desenvolvimento

Rodar gate completo:

```bash
./scripts/check-quality.sh --full
```

Rodar apenas frontend:

```bash
./scripts/check-frontend-quality.sh
```

Rodar apenas qualidade Rust:

```bash
./scripts/check-rust-quality.sh --exclude-tauri
```

## Contribuição

As regras de contribuição estão em [CONTRIBUTING.md](./CONTRIBUTING.md).

Em resumo, o fluxo esperado inclui:
- branch focada por mudança
- validação local antes de abrir PR
- explicação clara de mudança, motivação e validação

## Licença

MIT. Veja [LICENSE](./LICENSE).
