use std::path::{Path, PathBuf};

use luthier_core::{CreateOrchestratorRequest, CreateOrchestratorResult};
use luthier_orchestrator_core::GameConfig;

use crate::application::{ports::LuthierCorePort, use_cases};
use crate::error::BackendResult;
use crate::infrastructure::{
    fs_repo::LocalFileSystemRepository, http_client, http_client::ReqwestBlockingHttpClient,
    image_codec::ImageRsCodec, logging::StderrJsonBackendLogger, pe_icon_reader::PelitePeIconReader,
};
use crate::models::hero::HeroSearchResult;

pub use crate::models::dto::{
    CreateExecutableInput, CreateExecutableOutput, ExtractExecutableIconInput,
    ExtractExecutableIconOutput, HashExeInput, HashExeOutput, ImportRegistryFileInput,
    ImportRegistryFileOutput, ListChildDirectoriesInput, ListChildDirectoriesOutput,
    ListDirectoryEntriesInput, ListDirectoryEntriesOutput, PrepareHeroImageInput,
    PrepareHeroImageOutput, SearchHeroImageInput, SearchHeroImageOutput, TestConfigurationInput,
    TestConfigurationOutput, WinetricksAvailableOutput,
};

#[derive(Debug, Clone, Copy, Default)]
struct NativeLuthierCoreAdapter;

impl LuthierCorePort for NativeLuthierCoreAdapter {
    fn create_orchestrator_binary(
        &self,
        request: &CreateOrchestratorRequest,
    ) -> BackendResult<CreateOrchestratorResult> {
        luthier_core::create_orchestrator_binary(request).map_err(Into::into)
    }

    fn sha256_file(&self, path: &Path) -> BackendResult<String> {
        luthier_core::sha256_file(path).map_err(Into::into)
    }

    fn validate_game_config(&self, config: &GameConfig) -> BackendResult<()> {
        luthier_core::validate_game_config(config).map_err(Into::into)
    }
}

#[derive(Debug, Clone)]
struct NativeHeroSearchAdapter {
    client: reqwest::blocking::Client,
}

impl NativeHeroSearchAdapter {
    fn new() -> BackendResult<Self> {
        let client = http_client::build_hero_search_client().map_err(crate::error::BackendError::from)?;
        Ok(Self { client })
    }
}

impl use_cases::search_hero::HeroSearchPort for NativeHeroSearchAdapter {
    fn search_hero_image_via_steamgriddb_public(
        &self,
        game_name: &str,
    ) -> BackendResult<Option<HeroSearchResult>> {
        http_client::search_hero_image_via_steamgriddb_public(game_name, &self.client)
            .map_err(Into::into)
    }

    fn search_hero_image_via_steamgriddb_api(
        &self,
        game_name: &str,
    ) -> BackendResult<Option<HeroSearchResult>> {
        http_client::search_hero_image_via_steamgriddb_api(game_name, &self.client)
            .map_err(Into::into)
    }

    fn search_hero_image_via_usebottles(&self, game_name: &str) -> BackendResult<HeroSearchResult> {
        http_client::search_hero_image_via_usebottles(game_name, &self.client).map_err(Into::into)
    }
}

pub fn create_executable(input: CreateExecutableInput) -> Result<CreateExecutableOutput, String> {
    use_cases::create_executable::create_executable_command(input)
}

pub fn create_executable_with_base_hints(
    input: CreateExecutableInput,
    base_binary_hints: &[PathBuf],
) -> Result<CreateExecutableOutput, String> {
    use_cases::create_executable::create_executable_with_base_hints_command(
        input,
        base_binary_hints,
    )
}

pub fn hash_executable(input: HashExeInput) -> Result<HashExeOutput, String> {
    let luthier_core = NativeLuthierCoreAdapter;
    let logger = StderrJsonBackendLogger::new();
    use_cases::hash_executable::hash_executable_command(input, &luthier_core, &logger)
}

pub fn extract_executable_icon(
    input: ExtractExecutableIconInput,
) -> Result<ExtractExecutableIconOutput, String> {
    let file_system = LocalFileSystemRepository::new();
    let pe_icon_reader = PelitePeIconReader::new();
    let image_codec = ImageRsCodec::new();
    let logger = StderrJsonBackendLogger::new();
    use_cases::extract_icon::extract_executable_icon_command(
        input,
        &file_system,
        &pe_icon_reader,
        &image_codec,
        &logger,
    )
}

pub fn search_hero_image(input: SearchHeroImageInput) -> Result<SearchHeroImageOutput, String> {
    let hero_search = NativeHeroSearchAdapter::new().map_err(String::from)?;
    let logger = StderrJsonBackendLogger::new();
    use_cases::search_hero::search_hero_image_command(input, &hero_search, &logger)
}

pub fn prepare_hero_image(input: PrepareHeroImageInput) -> Result<PrepareHeroImageOutput, String> {
    let http_client = ReqwestBlockingHttpClient::new();
    let image_codec = ImageRsCodec::new();
    let logger = StderrJsonBackendLogger::new();
    use_cases::prepare_hero::prepare_hero_image_command(
        input,
        &http_client,
        &image_codec,
        &logger,
    )
}

pub fn test_configuration(
    input: TestConfigurationInput,
) -> Result<TestConfigurationOutput, String> {
    use_cases::test_configuration::test_configuration_command(input)
}

pub fn winetricks_available() -> Result<WinetricksAvailableOutput, String> {
    use_cases::winetricks_available::winetricks_available_command()
}

pub fn import_registry_file(
    input: ImportRegistryFileInput,
) -> Result<ImportRegistryFileOutput, String> {
    use_cases::import_registry::import_registry_file_command(input)
}

pub fn list_child_directories(
    input: ListChildDirectoriesInput,
) -> Result<ListChildDirectoriesOutput, String> {
    let file_system = LocalFileSystemRepository::new();
    let logger = StderrJsonBackendLogger::new();
    use_cases::list_fs::list_child_directories_command(input, &file_system, &logger)
}

pub fn list_directory_entries(
    input: ListDirectoryEntriesInput,
) -> Result<ListDirectoryEntriesOutput, String> {
    let file_system = LocalFileSystemRepository::new();
    let logger = StderrJsonBackendLogger::new();
    use_cases::list_fs::list_directory_entries_command(input, &file_system, &logger)
}
