use base64::{engine::general_purpose, Engine as _};
use image::{GenericImageView, ImageFormat};

use crate::domain::validation as domain_validation;
use crate::error::{BackendResult, BackendResultExt, CommandStringResult};
use crate::infrastructure::{http_client, image_codec, logging::log_backend_event};
use crate::models::dto::{PrepareHeroImageInput, PrepareHeroImageOutput};

const HERO_SPLASH_TARGET_WIDTH: u32 = 960;
const HERO_SPLASH_TARGET_HEIGHT: u32 = 310;

#[derive(Debug, Clone, Copy, Default)]
pub struct PrepareHeroUseCase;

impl PrepareHeroUseCase {
    pub fn new() -> Self {
        Self
    }

    pub fn execute(&self, input: PrepareHeroImageInput) -> BackendResult<PrepareHeroImageOutput> {
        let image_url = domain_validation::validate_prepare_hero_image_url_input(&input.image_url)?;

        log_backend_event(
            "INFO",
            "GO-CR-123",
            "prepare_hero_image_requested",
            serde_json::json!({ "image_url": image_url }),
        );

        let source_bytes = http_client::fetch_remote_bytes(image_url)?;
        let decoded = image::load_from_memory(&source_bytes)
            .map_err(|err| format!("failed to decode hero image: {err}"))?;
        let (original_width, original_height) = decoded.dimensions();
        let processed = image_codec::crop_to_ratio_and_resize(
            decoded,
            96,
            31,
            HERO_SPLASH_TARGET_WIDTH,
            HERO_SPLASH_TARGET_HEIGHT,
        )?;

        let (width, height) = processed.dimensions();
        let out_bytes = image_codec::encode_dynamic_image_to_bytes(&processed, ImageFormat::WebP)
            .map_err(|err| format!("failed to encode hero image as WebP: {err}"))?;

        let data_url = format!(
            "data:image/webp;base64,{}",
            general_purpose::STANDARD.encode(&out_bytes)
        );

        log_backend_event(
            "INFO",
            "GO-CR-124",
            "prepare_hero_image_completed",
            serde_json::json!({
                "image_url": image_url,
                "original_width": original_width,
                "original_height": original_height,
                "width": width,
                "height": height,
                "webp_size_bytes": out_bytes.len(),
            }),
        );

        Ok(PrepareHeroImageOutput {
            source_url: image_url.to_string(),
            data_url,
            width,
            height,
            original_width,
            original_height,
        })
    }

    pub fn execute_command_string(
        &self,
        input: PrepareHeroImageInput,
    ) -> CommandStringResult<PrepareHeroImageOutput> {
        self.execute(input).into_command_string_result()
    }
}

pub fn prepare_hero_image(input: PrepareHeroImageInput) -> BackendResult<PrepareHeroImageOutput> {
    PrepareHeroUseCase::new().execute(input)
}

pub fn prepare_hero_image_command(
    input: PrepareHeroImageInput,
) -> CommandStringResult<PrepareHeroImageOutput> {
    PrepareHeroUseCase::new().execute_command_string(input)
}
