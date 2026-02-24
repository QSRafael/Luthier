# creator-tauri-backend

Backend Rust para o App Criador.

Status atual:
- implementa funções puras para a UI chamar:
  - `create_executable(...)`
  - `hash_executable(...)`
- wrappers de comando preparados para Tauri:
  - `cmd_create_executable(...)`
  - `cmd_hash_executable(...)`
  - habilitados com feature `tauri-commands`.

Próxima etapa:
- integrar `Builder` Tauri e registrar comandos via `tauri::generate_handler!`.
