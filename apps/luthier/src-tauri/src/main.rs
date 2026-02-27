#[cfg(feature = "tauri-commands")]
use std::path::PathBuf;

#[cfg(feature = "tauri-commands")]
use luthier_backend::{
    create_executable_with_base_hints, extract_executable_icon, hash_executable,
    import_registry_file, list_child_directories, list_directory_entries, prepare_hero_image,
    search_hero_image, test_configuration, winetricks_available, CreateExecutableInput,
    CreateExecutableOutput, ExtractExecutableIconInput, ExtractExecutableIconOutput, HashExeInput,
    HashExeOutput, ImportRegistryFileInput, ImportRegistryFileOutput, ListChildDirectoriesInput,
    ListChildDirectoriesOutput, ListDirectoryEntriesInput, ListDirectoryEntriesOutput,
    PrepareHeroImageInput, PrepareHeroImageOutput, SearchHeroImageInput, SearchHeroImageOutput,
    TestConfigurationInput, TestConfigurationOutput, WinetricksAvailableOutput,
};
#[cfg(feature = "tauri-commands")]
use tauri::async_runtime::spawn_blocking;

#[cfg(feature = "tauri-commands")]
type CommandResult<T> = Result<T, String>;

#[cfg(feature = "tauri-commands")]
fn collect_orchestrator_base_hints(app: &tauri::AppHandle) -> Vec<PathBuf> {
    let resolver = app.path_resolver();
    let mut hints = Vec::<PathBuf>::new();

    if let Some(path) = resolver.resolve_resource("luthier-orchestrator-base/luthier-orchestrator")
    {
        hints.push(path);
    }
    if let Some(path) = resolver.resource_dir() {
        hints.push(path.join("luthier-orchestrator-base/luthier-orchestrator"));
    }
    if let Some(path) = resolver.app_data_dir() {
        hints.push(path.join("luthier-orchestrator-base/luthier-orchestrator"));
    }

    hints
}

#[cfg(feature = "tauri-commands")]
async fn run_blocking_command<T, F>(task_name: &'static str, f: F) -> CommandResult<T>
where
    T: Send + 'static,
    F: FnOnce() -> CommandResult<T> + Send + 'static,
{
    spawn_blocking(f)
        .await
        .map_err(|err| format!("failed to join {task_name} task: {err}"))?
}

#[cfg(feature = "tauri-commands")]
#[tauri::command]
async fn cmd_create_executable(
    app: tauri::AppHandle,
    input: CreateExecutableInput,
) -> CommandResult<CreateExecutableOutput> {
    let hints = collect_orchestrator_base_hints(&app);
    run_blocking_command("create executable", move || {
        create_executable_with_base_hints(input, &hints)
    })
    .await
}

#[cfg(feature = "tauri-commands")]
#[tauri::command]
async fn cmd_hash_executable(input: HashExeInput) -> CommandResult<HashExeOutput> {
    run_blocking_command("hash", move || hash_executable(input)).await
}

#[cfg(feature = "tauri-commands")]
#[tauri::command]
async fn cmd_extract_executable_icon(
    input: ExtractExecutableIconInput,
) -> CommandResult<ExtractExecutableIconOutput> {
    run_blocking_command("icon extraction", move || extract_executable_icon(input)).await
}

#[cfg(feature = "tauri-commands")]
#[tauri::command]
async fn cmd_test_configuration(
    input: TestConfigurationInput,
) -> CommandResult<TestConfigurationOutput> {
    run_blocking_command("test configuration", move || test_configuration(input)).await
}

#[cfg(feature = "tauri-commands")]
#[tauri::command]
async fn cmd_winetricks_available() -> CommandResult<WinetricksAvailableOutput> {
    run_blocking_command("winetricks", winetricks_available).await
}

#[cfg(feature = "tauri-commands")]
#[tauri::command]
async fn cmd_import_registry_file(
    input: ImportRegistryFileInput,
) -> CommandResult<ImportRegistryFileOutput> {
    run_blocking_command("registry import", move || import_registry_file(input)).await
}

#[cfg(feature = "tauri-commands")]
#[tauri::command]
async fn cmd_list_child_directories(
    input: ListChildDirectoriesInput,
) -> CommandResult<ListChildDirectoriesOutput> {
    run_blocking_command("list child directories", move || {
        list_child_directories(input)
    })
    .await
}

#[cfg(feature = "tauri-commands")]
#[tauri::command]
async fn cmd_list_directory_entries(
    input: ListDirectoryEntriesInput,
) -> CommandResult<ListDirectoryEntriesOutput> {
    run_blocking_command("list directory entries", move || {
        list_directory_entries(input)
    })
    .await
}

#[cfg(feature = "tauri-commands")]
#[tauri::command]
async fn cmd_search_hero_image(
    input: SearchHeroImageInput,
) -> CommandResult<SearchHeroImageOutput> {
    run_blocking_command("hero search", move || search_hero_image(input)).await
}

#[cfg(feature = "tauri-commands")]
#[tauri::command]
async fn cmd_prepare_hero_image(
    input: PrepareHeroImageInput,
) -> CommandResult<PrepareHeroImageOutput> {
    run_blocking_command("hero image processing", move || prepare_hero_image(input)).await
}

#[cfg(feature = "tauri-commands")]
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            cmd_create_executable,
            cmd_hash_executable,
            cmd_extract_executable_icon,
            cmd_test_configuration,
            cmd_winetricks_available,
            cmd_import_registry_file,
            cmd_list_child_directories,
            cmd_list_directory_entries,
            cmd_search_hero_image,
            cmd_prepare_hero_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running luthier backend");
}

#[cfg(not(feature = "tauri-commands"))]
fn main() {
    eprintln!(
        "luthier-backend built without Tauri runtime. Enable feature: --features tauri-commands"
    );
}
