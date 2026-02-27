use crate::application::ports::{BackendLogEvent, BackendLogLevel, BackendLoggerPort};
use crate::domain::validation as domain_validation;
use crate::error::{BackendResult, BackendResultExt, CommandStringResult};
use crate::models::dto::{SearchHeroImageInput, SearchHeroImageOutput};
use crate::models::hero::HeroSearchResult;

pub trait HeroSearchPort: Send + Sync {
    fn search_hero_image_via_steamgriddb_public(
        &self,
        game_name: &str,
    ) -> BackendResult<Option<HeroSearchResult>>;
    fn search_hero_image_via_steamgriddb_api(
        &self,
        game_name: &str,
    ) -> BackendResult<Option<HeroSearchResult>>;
    fn search_hero_image_via_usebottles(&self, game_name: &str) -> BackendResult<HeroSearchResult>;
}

pub struct SearchHeroUseCase<'a> {
    hero_search: &'a dyn HeroSearchPort,
    logger: &'a dyn BackendLoggerPort,
}

impl<'a> SearchHeroUseCase<'a> {
    pub fn new(hero_search: &'a dyn HeroSearchPort, logger: &'a dyn BackendLoggerPort) -> Self {
        Self {
            hero_search,
            logger,
        }
    }

    pub fn execute(&self, input: SearchHeroImageInput) -> BackendResult<SearchHeroImageOutput> {
        let game_name = domain_validation::validate_search_hero_game_name(&input.game_name)?;

        self.log_info(
            "GO-CR-121",
            "search_hero_image_requested",
            serde_json::json!({ "game_name": game_name }),
        );

        if let Some(result) = self
            .hero_search
            .search_hero_image_via_steamgriddb_public(game_name)?
        {
            self.log_completed_with_candidates(game_name, &result);
            return Ok(Self::to_output(result));
        }

        if let Some(result) = self
            .hero_search
            .search_hero_image_via_steamgriddb_api(game_name)?
        {
            self.log_completed_with_candidates(game_name, &result);
            return Ok(Self::to_output(result));
        }

        let result = self
            .hero_search
            .search_hero_image_via_usebottles(game_name)?;
        self.log_completed_simple(game_name, &result.image_url);

        Ok(Self::to_output(result))
    }

    pub fn execute_command_string(
        &self,
        input: SearchHeroImageInput,
    ) -> CommandStringResult<SearchHeroImageOutput> {
        self.execute(input).into_command_string_result()
    }

    fn log_info(&self, event_code: &str, message: &str, context: serde_json::Value) {
        let _ = self.logger.log(&BackendLogEvent {
            level: BackendLogLevel::Info,
            event_code: event_code.to_string(),
            message: message.to_string(),
            context,
        });
    }

    fn log_completed_with_candidates(&self, game_name: &str, result: &HeroSearchResult) {
        self.log_info(
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
        self.log_info(
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

pub fn search_hero_image(
    input: SearchHeroImageInput,
    hero_search: &dyn HeroSearchPort,
    logger: &dyn BackendLoggerPort,
) -> BackendResult<SearchHeroImageOutput> {
    SearchHeroUseCase::new(hero_search, logger).execute(input)
}

pub fn search_hero_image_command(
    input: SearchHeroImageInput,
    hero_search: &dyn HeroSearchPort,
    logger: &dyn BackendLoggerPort,
) -> CommandStringResult<SearchHeroImageOutput> {
    SearchHeroUseCase::new(hero_search, logger).execute_command_string(input)
}
