use base64::{engine::general_purpose, Engine as _};

use crate::application::ports::{
    BackendLogEvent, BackendLogLevel, BackendLoggerPort, HttpClientPort, HttpMethod, HttpRequest,
    HttpRequestBody, ImageCodecPort, RasterImage, RasterImageFormat, ResizeFilter,
};
use crate::domain::validation as domain_validation;
use crate::error::{BackendError, BackendResult, BackendResultExt, CommandStringResult};
use crate::models::dto::{PrepareHeroImageInput, PrepareHeroImageOutput};

const HERO_SPLASH_TARGET_WIDTH: u32 = 960;
const HERO_SPLASH_TARGET_HEIGHT: u32 = 310;
const HERO_IMAGE_FETCH_TIMEOUT_MS: u64 = 12_000;
const HERO_IMAGE_FETCH_USER_AGENT: &str = "luthier/0.1 hero-image-fetch";

pub struct PrepareHeroUseCase<'a> {
    http_client: &'a dyn HttpClientPort,
    image_codec: &'a dyn ImageCodecPort,
    logger: &'a dyn BackendLoggerPort,
}

impl<'a> PrepareHeroUseCase<'a> {
    pub fn new(
        http_client: &'a dyn HttpClientPort,
        image_codec: &'a dyn ImageCodecPort,
        logger: &'a dyn BackendLoggerPort,
    ) -> Self {
        Self {
            http_client,
            image_codec,
            logger,
        }
    }

    pub fn execute(&self, input: PrepareHeroImageInput) -> BackendResult<PrepareHeroImageOutput> {
        let image_url = domain_validation::validate_prepare_hero_image_url_input(&input.image_url)?;

        self.log_info(
            "GO-CR-123",
            "prepare_hero_image_requested",
            serde_json::json!({ "image_url": image_url }),
        );

        let source_bytes = self.fetch_remote_bytes(image_url)?;
        let decoded = self
            .image_codec
            .decode(&source_bytes)
            .map_err(|err| BackendError::internal(format!("failed to decode hero image: {err}")))?;
        let original_width = decoded.width;
        let original_height = decoded.height;
        let processed = self.crop_to_ratio_and_resize(
            &decoded,
            96,
            31,
            HERO_SPLASH_TARGET_WIDTH,
            HERO_SPLASH_TARGET_HEIGHT,
        )?;

        let width = processed.width;
        let height = processed.height;
        let out_bytes = self
            .image_codec
            .encode(&processed, RasterImageFormat::WebP)
            .map_err(|err| {
                BackendError::internal(format!("failed to encode hero image as WebP: {err}"))
            })?;

        let data_url = format!(
            "data:image/webp;base64,{}",
            general_purpose::STANDARD.encode(&out_bytes)
        );

        self.log_info(
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

    fn fetch_remote_bytes(&self, url: &str) -> BackendResult<Vec<u8>> {
        let response = self
            .http_client
            .send(&HttpRequest {
                method: HttpMethod::Get,
                url: url.to_string(),
                headers: vec![(
                    "user-agent".to_string(),
                    HERO_IMAGE_FETCH_USER_AGENT.to_string(),
                )],
                query: Vec::new(),
                body: HttpRequestBody::Empty,
                timeout_ms: Some(HERO_IMAGE_FETCH_TIMEOUT_MS),
            })
            .map_err(|err| err.with_context("failed to download hero image"))?;

        if !(200..300).contains(&response.status_code) {
            return Err(BackendError::internal(format!(
                "failed to download hero image (HTTP {})",
                response.status_code
            )));
        }

        Ok(response.body)
    }

    fn crop_to_ratio_and_resize(
        &self,
        image: &RasterImage,
        ratio_w: u32,
        ratio_h: u32,
        target_w: u32,
        target_h: u32,
    ) -> BackendResult<RasterImage> {
        let src_w = image.width;
        let src_h = image.height;
        if src_w == 0 || src_h == 0 {
            return Err("hero image has invalid dimensions".to_string().into());
        }

        let lhs = u64::from(src_w) * u64::from(ratio_h);
        let rhs = u64::from(src_h) * u64::from(ratio_w);

        let (crop_x, crop_y, crop_w, crop_h) = if lhs > rhs {
            let crop_w = ((u64::from(src_h) * u64::from(ratio_w)) / u64::from(ratio_h))
                .clamp(1, u64::from(src_w)) as u32;
            let crop_x = (src_w.saturating_sub(crop_w)) / 2;
            (crop_x, 0, crop_w, src_h)
        } else {
            let crop_h = ((u64::from(src_w) * u64::from(ratio_h)) / u64::from(ratio_w))
                .clamp(1, u64::from(src_h)) as u32;
            let crop_y = (src_h.saturating_sub(crop_h)) / 2;
            (0, crop_y, src_w, crop_h)
        };

        let cropped = self
            .image_codec
            .crop_imm(image, crop_x, crop_y, crop_w, crop_h)?;
        self.image_codec
            .resize_exact(&cropped, target_w, target_h, ResizeFilter::Lanczos3)
    }

    fn log_info(&self, event_code: &str, message: &str, context: serde_json::Value) {
        let _ = self.logger.log(&BackendLogEvent {
            level: BackendLogLevel::Info,
            event_code: event_code.to_string(),
            message: message.to_string(),
            context,
        });
    }
}

pub fn prepare_hero_image(
    input: PrepareHeroImageInput,
    http_client: &dyn HttpClientPort,
    image_codec: &dyn ImageCodecPort,
    logger: &dyn BackendLoggerPort,
) -> BackendResult<PrepareHeroImageOutput> {
    PrepareHeroUseCase::new(http_client, image_codec, logger).execute(input)
}

pub fn prepare_hero_image_command(
    input: PrepareHeroImageInput,
    http_client: &dyn HttpClientPort,
    image_codec: &dyn ImageCodecPort,
    logger: &dyn BackendLoggerPort,
) -> CommandStringResult<PrepareHeroImageOutput> {
    PrepareHeroUseCase::new(http_client, image_codec, logger).execute_command_string(input)
}
