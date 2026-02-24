# creator-tauri-backend

Backend Rust para o App Criador.

Status atual:
- implementa funções puras para a UI chamar:
  - `create_executable(...)`
  - `hash_executable(...)`

Próxima etapa:
- expor essas funções como `#[tauri::command]` quando o scaffold Tauri completo for integrado.
