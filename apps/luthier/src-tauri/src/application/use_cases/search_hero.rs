use crate::domain::validation as domain_validation;
use crate::error::{BackendResult, BackendResultExt, CommandStringResult};
use crate::infrastructure::{http_client, logging::log_backend_event};
use crate::models::dto::{SearchHeroImageInput, SearchHeroImageOutput};
use crate::models::hero::HeroSearchResult;

#[derive(Debug, Clone, Copy, Default)]
pub struct SearchHeroUseCase;

impl SearchHeroUseCase {
    pub fn new() -> Self {
        Self
    }

    pub fn execute(&self, input: SearchHeroImageInput) -> BackendResult<SearchHeroImageOutput> {
        let game_name = domain_validation::validate_search_hero_game_name(&input.game_name)?;

        log_backend_event(
            "INFO",
            "GO-CR-121",
            "search_hero_image_requested",
            serde_json::json!({ "game_name": game_name }),
        );

        let client = http_client::build_hero_search_client()?;

        if let Some(result) =
            http_client::search_hero_image_via_steamgriddb_public(game_name, &client)?
        {
            self.log_completed_with_candidates(game_name, &result);
            return Ok(Self::to_output(result));
        }

        if let Some(result) =
            http_client::search_hero_image_via_steamgriddb_api(game_name, &client)?
        {
            self.log_completed_with_candidates(game_name, &result);
            return Ok(Self::to_output(result));
        }

        let result = http_client::search_hero_image_via_usebottles(game_name, &client)?;
        self.log_completed_simple(game_name, &result.image_url);

        Ok(Self::to_output(result))
    }

    pub fn execute_command_string(
        &self,
        input: SearchHeroImageInput,
    ) -> CommandStringResult<SearchHeroImageOutput> {
        self.execute(input).into_command_string_result()
    }

    fn log_completed_with_candidates(&self, game_name: &str, result: &HeroSearchResult) {
        log_backend_event(
            "INFO",
            "GO-CR-122",
            "search_hero_image_completed",
            serde_json::json!({
                "game_name": game_name,
                "image_url": result.image_url,
                "source": result.source,
                "game_id": result.game_id,
                "candidate_count": result.candidate_image_urls.len(),
            }),
        );
    }

    fn log_completed_simple(&self, game_name: &str, image_url: &str) {
        log_backend_event(
            "INFO",
            "GO-CR-122",
            "search_hero_image_completed",
            serde_json::json!({
                "game_name": game_name,
                "image_url": image_url,
            }),
        );
    }

    fn to_output(result: HeroSearchResult) -> SearchHeroImageOutput {
        SearchHeroImageOutput {
            source: result.source,
            image_url: result.image_url,
            game_id: result.game_id,
            candidate_image_urls: result.candidate_image_urls,
        }
    }
}

pub fn search_hero_image(input: SearchHeroImageInput) -> BackendResult<SearchHeroImageOutput> {
    SearchHeroUseCase::new().execute(input)
}

pub fn search_hero_image_command(
    input: SearchHeroImageInput,
) -> CommandStringResult<SearchHeroImageOutput> {
    SearchHeroUseCase::new().execute_command_string(input)
}
