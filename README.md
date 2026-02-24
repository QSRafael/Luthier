# Game Orchestrator (Linux)

Workspace inicial para o App Criador e Orquestrador.

## Estrutura
- `crates/orchestrator-core`: modelos, trailer parser e utilitários compartilhados.
- `crates/creator-core`: backend local reutilizável para App Criador (hash, validação e geração).
- `bins/orchestrator`: CLI do orquestrador gerado.
- `bins/orchestrator-injector`: utilitário de injeção de payload no binário base.
- `docs/implementation-log.md`: diário técnico de implementação e decisões.
