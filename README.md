# Game Orchestrator (Linux)

Workspace inicial para o App Luthier e Luthier Orchestrator.

## Estrutura
- `crates/luthier-orchestrator-core`: modelos, trailer parser e utilitários compartilhados.
- `crates/luthier-core`: backend local reutilizável para App Luthier (hash, validação e geração).
- `bins/luthier-cli`: CLI para testar hash/test/create sem UI.
- `bins/luthier-orchestrator`: CLI do Luthier Orchestrator gerado.
- `bins/luthier-orchestrator-injector`: utilitário de injeção de payload no binário base.
- `docs/implementation-log.md`: diário técnico de implementação e decisões.
