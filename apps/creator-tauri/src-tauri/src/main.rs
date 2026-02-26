#[cfg(feature = "tauri-commands")]
fn main() {
    use std::path::PathBuf;
    use tauri::async_runtime::spawn_blocking;

    use creator_tauri_backend::{
        create_executable_with_base_hints, extract_executable_icon, hash_executable,
        import_registry_file, list_child_directories, prepare_hero_image, search_hero_image,
        test_configuration, winetricks_available, CreateExecutableInput, CreateExecutableOutput,
        ExtractExecutableIconInput, ExtractExecutableIconOutput, HashExeInput, HashExeOutput,
        ImportRegistryFileInput, ImportRegistryFileOutput, ListChildDirectoriesInput,
        ListChildDirectoriesOutput, PrepareHeroImageInput, PrepareHeroImageOutput,
        SearchHeroImageInput, SearchHeroImageOutput, TestConfigurationInput,
        TestConfigurationOutput, WinetricksAvailableOutput,
    };
    #[tauri::command]
    async fn cmd_create_executable(
        app: tauri::AppHandle,
        input: CreateExecutableInput,
    ) -> Result<CreateExecutableOutput, String> {
        let resolver = app.path_resolver();
        let mut hints = Vec::<PathBuf>::new();

        if let Some(path) = resolver.resolve_resource("orchestrator-base/orchestrator") {
            hints.push(path);
        }
        if let Some(path) = resolver.resource_dir() {
            hints.push(path.join("orchestrator-base/orchestrator"));
        }
        if let Some(path) = resolver.app_data_dir() {
            hints.push(path.join("orchestrator-base/orchestrator"));
        }

        spawn_blocking(move || create_executable_with_base_hints(input, &hints))
            .await
            .map_err(|err| format!("failed to join create executable task: {err}"))?
    }

    #[tauri::command]
    async fn cmd_hash_executable(input: HashExeInput) -> Result<HashExeOutput, String> {
        spawn_blocking(move || hash_executable(input))
            .await
            .map_err(|err| format!("failed to join hash task: {err}"))?
    }

    #[tauri::command]
    async fn cmd_extract_executable_icon(
        input: ExtractExecutableIconInput,
    ) -> Result<ExtractExecutableIconOutput, String> {
        spawn_blocking(move || extract_executable_icon(input))
            .await
            .map_err(|err| format!("failed to join icon extraction task: {err}"))?
    }

    #[tauri::command]
    async fn cmd_test_configuration(
        input: TestConfigurationInput,
    ) -> Result<TestConfigurationOutput, String> {
        spawn_blocking(move || test_configuration(input))
            .await
            .map_err(|err| format!("failed to join test configuration task: {err}"))?
    }

    #[tauri::command]
    async fn cmd_winetricks_available() -> Result<WinetricksAvailableOutput, String> {
        spawn_blocking(winetricks_available)
            .await
            .map_err(|err| format!("failed to join winetricks task: {err}"))?
    }

    #[tauri::command]
    async fn cmd_import_registry_file(
        input: ImportRegistryFileInput,
    ) -> Result<ImportRegistryFileOutput, String> {
        spawn_blocking(move || import_registry_file(input))
            .await
            .map_err(|err| format!("failed to join registry import task: {err}"))?
    }

    #[tauri::command]
    fn cmd_list_child_directories(
        input: ListChildDirectoriesInput,
    ) -> Result<ListChildDirectoriesOutput, String> {
        list_child_directories(input)
    }

    #[tauri::command]
    async fn cmd_search_hero_image(
        input: SearchHeroImageInput,
    ) -> Result<SearchHeroImageOutput, String> {
        spawn_blocking(move || search_hero_image(input))
            .await
            .map_err(|err| format!("failed to join hero search task: {err}"))?
    }

    #[tauri::command]
    async fn cmd_prepare_hero_image(
        input: PrepareHeroImageInput,
    ) -> Result<PrepareHeroImageOutput, String> {
        spawn_blocking(move || prepare_hero_image(input))
            .await
            .map_err(|err| format!("failed to join hero image processing task: {err}"))?
    }

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            cmd_create_executable,
            cmd_hash_executable,
            cmd_extract_executable_icon,
            cmd_test_configuration,
            cmd_winetricks_available,
            cmd_import_registry_file,
            cmd_list_child_directories,
            cmd_search_hero_image,
            cmd_prepare_hero_image
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
