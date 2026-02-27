# luthier-backend

Backend Rust para o App Luthier.

Status atual:

- implementa funções puras para a UI chamar:
  - `create_executable(...)`
  - `hash_executable(...)`
- wrappers de comando preparados para Tauri:
  - `cmd_create_executable(...)`
  - `cmd_hash_executable(...)`
  - `cmd_test_configuration(...)`
  - habilitados com feature `tauri-commands`.

Próxima etapa:

- integrar frontend em `devUrl`/`frontendDist` do `tauri.conf.json`.

Execução (backend Tauri real):

- `cargo run -p luthier-backend --features tauri-commands`
