# Debito Tecnico e Pendencias (Luthier)

## Objetivo
Este documento consolida o que ainda falta fazer no projeto com base em:
- especificacao em [context.md](./context.md)
- estado atual do repositorio (codigo + scripts + CI)
- comportamento implementado e validado localmente nas rodadas anteriores

Data da revisao: 2026-02-26.

## Resumo Executivo
O projeto ja tem uma base forte e funcional para uso local:
- App Luthier (Tauri/Solid) robusto para autoria de payload
- geracao do binario com payload embutido
- pipeline principal do Luthier Orchestrator (`--show-config`, `--doctor`, `--config`, `--winecfg`, `--play`)
- splash pre-launch + configuracao rapida + feedback visual
- logs NDJSON e CI basico

Os maiores gaps restantes estao em:
- persistencia local (SQLite) e telemetria opt-in
- aplicacao completa de `winecfg`
- distribuicao/release (AppImage/checksum/assinatura)
- bundle de diagnostico e hardening final
- alinhamento final de i18n e documentacao com o que o `context.md` planeja

## Legenda de Prioridade
- `P0` = bloqueia MVP/aceite ou causa risco alto
- `P1` = importante para MVP funcional/publicacao inicial
- `P2` = melhoria relevante / pos-MVP / hardening
- `P3` = refinamento, organizacao, conveniencia

## Pendencias Previstas no `context.md` (nao concluidas ou parciais)

### P0 / P1 - MVP e Criterios de Aceite

- `P0` Aplicacao completa de `winecfg` no Luthier Orchestrator (parcial hoje)
  - Previsto em: seções `4.8`, `7.2`, `12 (Criterios de Aceite)`
  - Estado atual:
    - aplicado: `windows_version`, `dll_overrides`, toggles graficos (parte), desktop virtual, DPI
    - **nao aplicado / parcial**: `desktop_integration`, `mime_associations`, `desktop_folders`, `drives`, `audio_driver`
  - Impacto:
    - UI permite configurar, mas parte relevante nao produz efeito real no prefixo
  - Acao recomendada:
    - completar geracao/aplicacao de overrides por bloco e manter cache por hash

- `P0` Persistencia local do App Luthier (SQLite) para perfis/configs globais
  - Previsto em: `2.1`, `4.10`, `9.1`, `3 (Stack)`
  - Estado atual:
    - sem SQLite no backend Tauri
    - persistencia atual e limitada (tema/idioma e overrides do launcher no runtime)
  - Impacto:
    - app ainda nao atende o requisito de banco local MVP para perfis/projetos
  - Acao recomendada:
    - definir schema SQLite (jogos/projetos, metadados, preferencias globais, cache de hero image opcional)

- `P0` Persistencia local de resultado de execucao e fluxo de telemetria opt-in
  - Previsto em: `2.2`, `9`, `Fase 9`
  - Estado atual:
    - splash de feedback pos-jogo existe
    - `telemetry_opt_in` existe no modelo
    - **nao ha persistencia local dos resultados** nem envio remoto funcional
  - Impacto:
    - criterio de "persiste localmente e envia remoto se opt-in" ainda nao foi atendido
  - Acao recomendada:
    - salvar resultado da sessao localmente (JSON/SQLite) e introduzir fila local de envio opt-in

- `P1` Contrato de API comunitaria (preparado) e cliente desacoplado
  - Previsto em: `2.3`, `9.2`
  - Estado atual:
    - direcao de produto existe no `context.md`
    - nao ha contrato/versionamento de API no repo (schemas/endpoints/client DTOs)
  - Impacto:
    - integrações futuras ficam ad hoc
  - Acao recomendada:
    - definir docs/schemas de payload de submissao e resultados (OpenAPI ou JSON schema)

- `P1` Estado da splash/config rapida vs Fase 8 (reuso de UI)
  - Previsto em: `Fase 8` (reutilizar mesma UI da splash/config)
  - Estado atual:
    - splash config rapida existe e funciona
    - implementacao e customizada no orquestrador (nao reuso da UI do App Luthier)
  - Impacto:
    - manutencao duplicada de opcoes/rotulos/regras
  - Acao recomendada:
    - definir limite: manter UI separada (MVP) com tabela de mapeamento clara, ou planejar reuso real

### P1 - Distribuicao / Release / Operacao

- `P1` Distribuicao primaria AppImage (mais rpm/deb) para publicacao
  - Previsto em: `Fase 10`, `Decisoes Fechadas`, `Criterios de Aceite`
  - Estado atual:
    - targets Tauri incluem `appimage/deb/rpm`
    - nao ha pipeline de release/publicacao pronto no GitHub
    - nao ha documentacao de release reproducivel para artefatos
  - Acao recomendada:
    - criar workflow de release (build matrix + upload artifacts)

- `P1` Checksum/assinatura de artefatos
  - Previsto em: `Fase 12`
  - Estado atual: nao implementado
  - Acao recomendada:
    - gerar SHA256 para AppImage/deb/rpm e documentar verificacao
    - avaliar assinatura (GPG/cosign) conforme estrategia de distribuicao

- `P1` Bundle de diagnostico exportavel (suporte)
  - Previsto em: `20.4`, `21.4`, F6 (observabilidade completa + bundle)
  - Estado atual:
    - logs NDJSON existem
    - **bundle de diagnostico** (coleta de logs/config/doctor) nao existe
  - Acao recomendada:
    - comando `--bundle-diagnostics` (ou acao no app) com redacao de dados sensiveis

- `P1` Matriz de testes por distro/GPU/session
  - Previsto em: `20.6`, `22.2`, `Fase 10`
  - Estado atual:
    - CI de frontend + Rust core existe
    - sem matriz E2E (X11/Wayland, AMD/NVIDIA, Proton/UMU)
  - Acao recomendada:
    - definir checklist manual oficial + smoke tests automatizados onde possivel

### P1 / P2 - i18n e UX previstas no contexto

- `P1` i18n ponta a ponta em Rust (CLI/splash) no stack previsto
  - Previsto em: `3 (fluent-bundle + unic-langid)`, `19`, `Fase 12`
  - Estado atual:
    - suporte de idioma existe na splash/CLI (pt-BR/en-US) por tabela local/manual
    - **nao usa** `fluent-bundle`/`unic-langid` conforme stack planejado
  - Impacto:
    - funcionalmente ok para 2 idiomas, mas foge da arquitetura prevista
  - Acao recomendada:
    - decidir se mantem abordagem leve atual (documentar decisao) ou migrar para Fluent

- `P2` Alinhamento final das abas do `context.md` com a UI atual
  - Previsto em: `17` e `18`
  - Estado atual:
    - UI evoluiu (ex.: divisao da aba de jogo em duas; reorganizacoes)
    - `context.md` ainda descreve uma estrutura antiga em alguns trechos
  - Acao recomendada:
    - atualizar seções 17/18 para refletir a UI real (Luthier atual)

### P2 - Itens do TODO no proprio `context.md`

- `P2` Arrumar `gamescope` obrigatorio
  - Previsto em: `23) Todo`
  - Estado atual:
    - regra foi ajustada em alguns pontos (inclusive splash/config)
    - ainda vale uma revisao pontual para garantir consistencia em UI + payload + create validation
  - Acao recomendada:
    - registrar regra final e adicionar teste de regressao

- `P2` Logo em vez do titulo (splash)
  - Previsto em: `23) Todo`
  - Estado atual:
    - splash usa titulo textual + hero image
    - logo de marca/lockup ainda nao foi integrado
  - Acao recomendada:
    - definir asset de marca e fallback quando nao houver hero image

- `P2` "pastas sendo criadas no local/share"
  - Previsto em: `23) Todo`
  - Estado atual:
    - TODO aberto no contexto, sem criterio detalhado documentado
  - Acao recomendada:
    - esclarecer bug (qual pasta, em qual fluxo) e transformar em issue tecnica reproduzivel

## Itens Pos-MVP / Fora do Escopo Inicial (planejados, ainda nao feitos)

- `P2` Servidor comunitario (API REST)
- `P2` Fila offline para telemetria/eventos
- `P2` Import/export de perfis e sincronizacao opcional
- `P2` Assinatura de perfis comunitarios / reputacao / moderacao (fase posterior)

## Debitos Tecnicos Relevantes (nao necessariamente explicitos no `context.md`)

- `P1` Cobertura automatizada de validacao de payload (frontend x backend x runtime)
  - O backend canonicamente valida payload, mas ainda faltam testes de regressao focados em regras de negocio (ex.: gamescope, winecfg, paths)

- `P1` Testes E2E do launcher gerado (fixture)
  - Ideal criar um fixture de payload e validar `--show-config`, `--doctor`, `--play` em dry-run no CI

- `P2` Politica de compatibilidade de logs/event codes
  - Prefixo `GO-*` foi mantido por estabilidade; se houver rebrand de protocolo (`LU-*`), precisa plano de migracao/documentacao

- `P2` Cache local de hero image no App Luthier
  - hoje download/processamento funciona, mas sem cache dedicado por URL/game id

- `P2` Documentacao de dependencias de sistema (Linux) por distro
  - importante para onboarding de contribuidores e usuarios que vao testar Tauri localmente

- `P2` Automacao de build enxuto do orquestrador (release + strip/LTO)
  - parte das discussoes foi validada, mas vale consolidar no fluxo de build oficial para reduzir tamanho do binario gerado

- `P3` Revisao de copy tecnica vs copy de produto
  - alguns textos visiveis falam em "Luthier Orchestrator" (correto tecnicamente), mas pode valer padronizar onde mostrar so "Luthier"

## Recomendacao de Ordem de Execucao (pragmatica)

1. Fechar gaps de MVP funcional/aceite
- `winecfg` completo (aplicacao real)
- persistencia local (SQLite) no App Luthier
- persistencia de resultados + telemetria opt-in local

2. Fechar operacao/publicacao
- release AppImage/rpm/deb
- checksum/assinatura
- bundle de diagnostico

3. Fechar alinhamento de docs e hardening
- atualizar `context.md` (abas/regras reais)
- matriz de testes/release checklist
- documentacao de setup por distro

4. Pos-MVP
- API comunitaria
- sincronizacao/fila offline
- melhorias avancadas de UX e branding (logo/splash)

## Itens Fortes (ja implementados e que merecem preservacao)

- Autoria de payload no App Luthier com UI rica (dialogs, tabelas, validacoes, i18n, hero image)
- Injeção de payload no binario base do Luthier Orchestrator
- Pipeline do launcher (doctor -> prefix -> mounts -> scripts -> launch)
- Splash pre-launch/config/feedback no orquestrador
- Logs NDJSON AI-first
- Scripts de qualidade e CI separados (frontend + rust-core)

## Observacao Final
Este documento lista o que falta e o que esta parcial. Ele nao substitui o `context.md`; serve como backlog tecnico orientado por entrega.
