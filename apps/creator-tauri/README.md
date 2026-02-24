# creator-tauri

App Criador em Tauri + SolidJS.

Status atual:
- frontend mínimo (Vite + Solid) com abas:
  - Jogo
  - Runtime
  - Revisao e Gerar
- botões funcionais na UI:
  - `Calcular Hash`
  - `Testar`
  - `Criar Executavel`
- backend Rust em `src-tauri/` com comandos:
  - `cmd_hash_executable`
  - `cmd_test_configuration`
  - `cmd_create_executable`

Rodar frontend (dev):
- `pnpm dev` (ou `npm run dev`)

Rodar backend Tauri:
- `cargo run -p creator-tauri-backend --features tauri-commands`
