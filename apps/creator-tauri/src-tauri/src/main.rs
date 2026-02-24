#[cfg(feature = "tauri-commands")]
fn main() {
    use creator_tauri_backend::{
        cmd_create_executable, cmd_hash_executable, cmd_test_configuration,
        cmd_winetricks_available,
    };

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            cmd_create_executable,
            cmd_hash_executable,
            cmd_test_configuration,
            cmd_winetricks_available
        ])
        .run(tauri::generate_context!())
        .expect("error while running creator tauri backend");
}

#[cfg(not(feature = "tauri-commands"))]
fn main() {
    eprintln!(
        "creator-tauri-backend built without Tauri runtime. Enable feature: --features tauri-commands"
    );
}
