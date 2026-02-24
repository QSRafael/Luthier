#[cfg(feature = "tauri-commands")]
fn main() {
    use creator_tauri_backend::{
        create_executable, hash_executable, import_registry_file, list_child_directories,
        test_configuration, winetricks_available,
        CreateExecutableInput, CreateExecutableOutput, HashExeInput, HashExeOutput,
        ImportRegistryFileInput, ImportRegistryFileOutput, ListChildDirectoriesInput,
        ListChildDirectoriesOutput, TestConfigurationInput, TestConfigurationOutput,
        WinetricksAvailableOutput,
    };

    #[tauri::command]
    fn cmd_create_executable(
        input: CreateExecutableInput,
    ) -> Result<CreateExecutableOutput, String> {
        create_executable(input)
    }

    #[tauri::command]
    fn cmd_hash_executable(input: HashExeInput) -> Result<HashExeOutput, String> {
        hash_executable(input)
    }

    #[tauri::command]
    fn cmd_test_configuration(
        input: TestConfigurationInput,
    ) -> Result<TestConfigurationOutput, String> {
        test_configuration(input)
    }

    #[tauri::command]
    fn cmd_winetricks_available() -> Result<WinetricksAvailableOutput, String> {
        winetricks_available()
    }

    #[tauri::command]
    fn cmd_import_registry_file(input: ImportRegistryFileInput) -> Result<ImportRegistryFileOutput, String> {
        import_registry_file(input)
    }

    #[tauri::command]
    fn cmd_list_child_directories(
        input: ListChildDirectoriesInput,
    ) -> Result<ListChildDirectoriesOutput, String> {
        list_child_directories(input)
    }

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            cmd_create_executable,
            cmd_hash_executable,
            cmd_test_configuration,
            cmd_winetricks_available,
            cmd_import_registry_file,
            cmd_list_child_directories
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
