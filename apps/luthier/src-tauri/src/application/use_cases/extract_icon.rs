use std::path::PathBuf;

use base64::{engine::general_purpose, Engine as _};

use crate::application::ports::{
    BackendLogEvent, BackendLogLevel, BackendLoggerPort, FileSystemPort, ImageCodecPort,
    PeIconReaderPort, RasterImage, RasterImageFormat,
};
use crate::error::{BackendResult, BackendResultExt, CommandStringResult};
use crate::models::dto::{ExtractExecutableIconInput, ExtractExecutableIconOutput};

pub struct ExtractIconUseCase<'a> {
    file_system: &'a dyn FileSystemPort,
    pe_icon_reader: &'a dyn PeIconReaderPort,
    image_codec: &'a dyn ImageCodecPort,
    logger: &'a dyn BackendLoggerPort,
}

impl<'a> ExtractIconUseCase<'a> {
    pub fn new(
        file_system: &'a dyn FileSystemPort,
        pe_icon_reader: &'a dyn PeIconReaderPort,
        image_codec: &'a dyn ImageCodecPort,
        logger: &'a dyn BackendLoggerPort,
    ) -> Self {
        Self {
            file_system,
            pe_icon_reader,
            image_codec,
            logger,
        }
    }

    pub fn execute(
        &self,
        input: ExtractExecutableIconInput,
    ) -> BackendResult<ExtractExecutableIconOutput> {
        let path = PathBuf::from(&input.executable_path);

        self.log_info(
            "GO-CR-111",
            "extract_executable_icon_requested",
            serde_json::json!({ "path": path }),
        );

        let bytes = self
            .file_system
            .read_bytes(&path)
            .map_err(|err| err.with_context("failed to read executable"))?;
        let (png_bytes, width, height) = self.extract_best_exe_icon_png(&bytes)?;
        let data_url = format!(
            "data:image/png;base64,{}",
            general_purpose::STANDARD.encode(&png_bytes)
        );

        self.log_info(
            "GO-CR-112",
            "extract_executable_icon_completed",
            serde_json::json!({
                "path": path,
                "width": width,
                "height": height,
                "png_size_bytes": png_bytes.len(),
            }),
        );

        Ok(ExtractExecutableIconOutput {
            data_url,
            width,
            height,
        })
    }

    pub fn execute_command_string(
        &self,
        input: ExtractExecutableIconInput,
    ) -> CommandStringResult<ExtractExecutableIconOutput> {
        self.execute(input).into_command_string_result()
    }

    fn extract_best_exe_icon_png(&self, exe_bytes: &[u8]) -> BackendResult<(Vec<u8>, u32, u32)> {
        let icons = self.pe_icon_reader.read_ico_icon_groups(exe_bytes)?;
        if icons.is_empty() {
            return Err("no icon resources found in executable".to_string().into());
        }

        let mut best_image: Option<RasterImage> = None;
        let mut best_area = 0u64;

        for icon_bytes in icons {
            let decoded = match self
                .image_codec
                .decode_with_format(&icon_bytes, RasterImageFormat::Ico)
            {
                Ok(image) => image,
                Err(_) => continue,
            };

            let area = u64::from(decoded.width) * u64::from(decoded.height);
            if area > best_area {
                best_area = area;
                best_image = Some(decoded);
            }
        }

        let mut image = match best_image {
            Some(image) => image,
            None => {
                return Err("failed to decode icon resources to image"
                    .to_string()
                    .into())
            }
        };

        if image.width > 256 || image.height > 256 {
            image = self.image_codec.thumbnail(&image, 256, 256)?;
        }

        let width = image.width;
        let height = image.height;
        let png_bytes = self.image_codec.encode(&image, RasterImageFormat::Png)?;

        Ok((png_bytes, width, height))
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

pub fn extract_executable_icon(
    input: ExtractExecutableIconInput,
    file_system: &dyn FileSystemPort,
    pe_icon_reader: &dyn PeIconReaderPort,
    image_codec: &dyn ImageCodecPort,
    logger: &dyn BackendLoggerPort,
) -> BackendResult<ExtractExecutableIconOutput> {
    ExtractIconUseCase::new(file_system, pe_icon_reader, image_codec, logger).execute(input)
}

pub fn extract_executable_icon_command(
    input: ExtractExecutableIconInput,
    file_system: &dyn FileSystemPort,
    pe_icon_reader: &dyn PeIconReaderPort,
    image_codec: &dyn ImageCodecPort,
    logger: &dyn BackendLoggerPort,
) -> CommandStringResult<ExtractExecutableIconOutput> {
    ExtractIconUseCase::new(file_system, pe_icon_reader, image_codec, logger)
        .execute_command_string(input)
}
