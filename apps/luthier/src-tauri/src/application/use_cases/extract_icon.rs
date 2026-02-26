use std::path::PathBuf;

use base64::{Engine as _, engine::general_purpose};

use crate::error::{BackendError, BackendResult, BackendResultExt, CommandStringResult};
use crate::infrastructure::{
    fs_repo, image_codec, logging::log_backend_event, pe_icon_reader,
};
use crate::models::dto::{ExtractExecutableIconInput, ExtractExecutableIconOutput};

#[derive(Debug, Clone, Copy, Default)]
pub struct ExtractIconUseCase;

impl ExtractIconUseCase {
    pub fn new() -> Self {
        Self
    }

    pub fn execute(
        &self,
        input: ExtractExecutableIconInput,
    ) -> BackendResult<ExtractExecutableIconOutput> {
        let path = PathBuf::from(&input.executable_path);

        log_backend_event(
            "INFO",
            "GO-CR-111",
            "extract_executable_icon_requested",
            serde_json::json!({ "path": path }),
        );

        let bytes = fs_repo::read_bytes(&path)
            .map_err(|err| err.with_context("failed to read executable"))?;
        let (png_bytes, width, height) = extract_best_exe_icon_png(&bytes)?;
        let data_url = format!(
            "data:image/png;base64,{}",
            general_purpose::STANDARD.encode(&png_bytes)
        );

        log_backend_event(
            "INFO",
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
}

pub fn extract_executable_icon(
    input: ExtractExecutableIconInput,
) -> BackendResult<ExtractExecutableIconOutput> {
    ExtractIconUseCase::new().execute(input)
}

pub fn extract_executable_icon_command(
    input: ExtractExecutableIconInput,
) -> CommandStringResult<ExtractExecutableIconOutput> {
    ExtractIconUseCase::new().execute_command_string(input)
}

fn extract_best_exe_icon_png(exe_bytes: &[u8]) -> BackendResult<(Vec<u8>, u32, u32)> {
    let icons = pe_icon_reader::read_all_pe_icon_groups(exe_bytes).map_err(BackendError::from)?;
    image_codec::extract_best_png_from_ico_groups(icons).map_err(BackendError::from)
}
