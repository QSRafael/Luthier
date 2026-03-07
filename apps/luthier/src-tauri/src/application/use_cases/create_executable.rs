use std::path::PathBuf;

use luthier_core::CreateOrchestratorRequest;
use luthier_orchestrator_core::GameConfig;

use crate::application::ports::{
    BackendLogEvent, BackendLogLevel, BackendLoggerPort, BaseBinaryResolverPort, LuthierCorePort,
};
use crate::error::{BackendError, BackendResult, BackendResultExt, CommandStringResult};
use crate::models::dto::{CreateExecutableInput, CreateExecutableOutput};

const DEFAULT_HERO_IMAGE_MAX_BYTES: usize = 8 * 1024 * 1024;
const DEFAULT_ICON_PNG_MAX_BYTES: usize = 1024 * 1024;
const HERO_IMAGE_MAX_BYTES_ENV: &str = "LUTHIER_HERO_IMAGE_MAX_BYTES";
const ICON_PNG_MAX_BYTES_ENV: &str = "LUTHIER_ICON_PNG_MAX_BYTES";

pub struct CreateExecutableUseCase<'a> {
    luthier_core: &'a dyn LuthierCorePort,
    base_binary_resolver: &'a dyn BaseBinaryResolverPort,
    logger: &'a dyn BackendLoggerPort,
}

impl<'a> CreateExecutableUseCase<'a> {
    pub fn new(
        luthier_core: &'a dyn LuthierCorePort,
        base_binary_resolver: &'a dyn BaseBinaryResolverPort,
        logger: &'a dyn BackendLoggerPort,
    ) -> Self {
        Self {
            luthier_core,
            base_binary_resolver,
            logger,
        }
    }

    pub fn execute(&self, input: CreateExecutableInput) -> BackendResult<CreateExecutableOutput> {
        self.execute_with_base_hints(input, &[])
    }

    pub fn execute_with_base_hints(
        &self,
        input: CreateExecutableInput,
        base_binary_hints: &[PathBuf],
    ) -> BackendResult<CreateExecutableOutput> {
        self.log_info(
            "GO-CR-001",
            "create_executable_requested",
            serde_json::json!({
                "requested_base_binary_path": &input.base_binary_path,
                "output_path": &input.output_path,
                "backup_existing": input.backup_existing,
                "make_executable": input.make_executable,
                "hero_image_bytes_len": input.hero_image_bytes.as_ref().map(|bytes| bytes.len()),
                "icon_png_bytes_len": input.icon_png_bytes.as_ref().map(|bytes| bytes.len()),
                "hints_count": base_binary_hints.len(),
            }),
        );

        let hero_image_bytes =
            validate_optional_hero_image_bytes(input.hero_image_bytes.as_deref())?
                .map(ToOwned::to_owned);
        let icon_png_bytes = validate_optional_icon_png_bytes(input.icon_png_bytes.as_deref())?
            .map(ToOwned::to_owned);

        let config: GameConfig = serde_json::from_str(&input.config_json)
            .map_err(|err| BackendError::internal(format!("invalid config JSON: {err}")))?;

        self.log_base_orchestrator_resolution_attempts(&input.base_binary_path, base_binary_hints);
        let resolved_base_binary_path = self
            .base_binary_resolver
            .resolve_base_orchestrator_binary(&input.base_binary_path, base_binary_hints)?;

        self.log_info(
            "GO-CR-010",
            "base_orchestrator_binary_resolved",
            serde_json::json!({
                "resolved_base_binary_path": resolved_base_binary_path,
            }),
        );

        let request = CreateOrchestratorRequest {
            base_binary_path: resolved_base_binary_path.clone(),
            output_path: PathBuf::from(&input.output_path),
            config,
            hero_image_bytes,
            icon_png_bytes,
            backup_existing: input.backup_existing,
            make_executable: input.make_executable,
        };

        self.luthier_core
            .validate_game_config(&request.config)
            .inspect_err(|err| {
                self.log_create_failed(err, &request.base_binary_path, &request.output_path);
            })?;

        let result = self
            .luthier_core
            .create_orchestrator_binary(&request)
            .inspect_err(|err| {
                self.log_create_failed(err, &request.base_binary_path, &request.output_path);
            })?;

        self.log_info(
            "GO-CR-020",
            "create_executable_completed",
            serde_json::json!({
                "output_path": &result.output_path,
                "config_size_bytes": result.config_size_bytes,
                "config_sha256_hex": &result.config_sha256_hex,
                "resolved_base_binary_path": &resolved_base_binary_path,
            }),
        );

        Ok(CreateExecutableOutput {
            output_path: result.output_path,
            config_size_bytes: result.config_size_bytes,
            config_sha256_hex: result.config_sha256_hex,
            resolved_base_binary_path: request.base_binary_path.to_string_lossy().into_owned(),
        })
    }

    pub fn execute_command_string(
        &self,
        input: CreateExecutableInput,
    ) -> CommandStringResult<CreateExecutableOutput> {
        self.execute(input).into_command_string_result()
    }

    pub fn execute_with_base_hints_command_string(
        &self,
        input: CreateExecutableInput,
        base_binary_hints: &[PathBuf],
    ) -> CommandStringResult<CreateExecutableOutput> {
        self.execute_with_base_hints(input, base_binary_hints)
            .into_command_string_result()
    }

    fn log_base_orchestrator_resolution_attempts(&self, requested: &str, extra_hints: &[PathBuf]) {
        let attempted = self
            .base_binary_resolver
            .collect_base_orchestrator_binary_candidates(requested, extra_hints)
            .into_iter()
            .map(|path| path.to_string_lossy().into_owned())
            .collect::<Vec<_>>();

        self.log_info(
            "GO-CR-011",
            "resolving_base_orchestrator_binary",
            serde_json::json!({
                "requested": requested.trim(),
                "extra_hints_count": extra_hints.len(),
                "attempted_candidates": attempted,
            }),
        );
    }

    fn log_create_failed(
        &self,
        err: &BackendError,
        base_binary_path: &std::path::Path,
        output_path: &std::path::Path,
    ) {
        self.log_error(
            "GO-CR-090",
            "create_executable_failed",
            serde_json::json!({
                "error": err.to_string(),
                "base_binary_path": base_binary_path,
                "output_path": output_path,
                "validation_issues": Self::validation_issues_from_error(err),
            }),
        );
    }

    fn validation_issues_from_error(err: &BackendError) -> Option<Vec<serde_json::Value>> {
        err.details()
            .and_then(|details| details.get("validation_issues"))
            .and_then(|issues| issues.as_array())
            .map(|issues| {
                issues
                    .iter()
                    .map(|issue| {
                        serde_json::json!({
                            "code": issue.get("code").cloned().unwrap_or(serde_json::Value::Null),
                            "field": issue.get("field").cloned().unwrap_or(serde_json::Value::Null),
                            "message": issue
                                .get("message")
                                .cloned()
                                .unwrap_or(serde_json::Value::Null),
                        })
                    })
                    .collect::<Vec<serde_json::Value>>()
            })
    }

    fn log_info(&self, event_code: &str, message: &str, context: serde_json::Value) {
        self.log(BackendLogLevel::Info, event_code, message, context);
    }

    fn log_error(&self, event_code: &str, message: &str, context: serde_json::Value) {
        self.log(BackendLogLevel::Error, event_code, message, context);
    }

    fn log(
        &self,
        level: BackendLogLevel,
        event_code: &str,
        message: &str,
        context: serde_json::Value,
    ) {
        let _ = self.logger.log(&BackendLogEvent {
            level,
            event_code: event_code.to_string(),
            message: message.to_string(),
            context,
        });
    }
}

fn validate_optional_hero_image_bytes(bytes: Option<&[u8]>) -> BackendResult<Option<&[u8]>> {
    let bytes = if let Some(bytes) = bytes {
        bytes
    } else {
        return Ok(None);
    };

    if bytes.is_empty() {
        return Err(BackendError::invalid_input(
            "hero_image bytes must not be empty when provided",
        )
        .with_code("hero_image_empty"));
    }

    let max_bytes =
        read_size_limit_from_env(HERO_IMAGE_MAX_BYTES_ENV, DEFAULT_HERO_IMAGE_MAX_BYTES);
    if bytes.len() > max_bytes {
        return Err(BackendError::invalid_input(format!(
            "hero_image exceeds max size limit ({max_bytes} bytes)"
        ))
        .with_code("hero_image_too_large")
        .with_details_json(serde_json::json!({
            "max_bytes": max_bytes,
            "actual_bytes": bytes.len(),
        })));
    }

    if detect_hero_image_mime(bytes).is_none() {
        return Err(BackendError::invalid_input(
            "hero_image must be PNG, JPEG, or WebP binary data",
        )
        .with_code("hero_image_unsupported_mime"));
    }

    Ok(Some(bytes))
}

fn validate_optional_icon_png_bytes(bytes: Option<&[u8]>) -> BackendResult<Option<&[u8]>> {
    let bytes = if let Some(bytes) = bytes {
        bytes
    } else {
        return Ok(None);
    };

    if bytes.is_empty() {
        return Err(
            BackendError::invalid_input("icon_png bytes must not be empty when provided")
                .with_code("icon_png_empty"),
        );
    }

    let max_bytes = read_size_limit_from_env(ICON_PNG_MAX_BYTES_ENV, DEFAULT_ICON_PNG_MAX_BYTES);
    if bytes.len() > max_bytes {
        return Err(BackendError::invalid_input(format!(
            "icon_png exceeds max size limit ({max_bytes} bytes)"
        ))
        .with_code("icon_png_too_large")
        .with_details_json(serde_json::json!({
            "max_bytes": max_bytes,
            "actual_bytes": bytes.len(),
        })));
    }

    if !is_png(bytes) {
        return Err(
            BackendError::invalid_input("icon_png must be PNG binary data")
                .with_code("icon_png_invalid_mime"),
        );
    }

    Ok(Some(bytes))
}

fn detect_hero_image_mime(bytes: &[u8]) -> Option<&'static str> {
    if is_png(bytes) {
        return Some("image/png");
    }
    if is_jpeg(bytes) {
        return Some("image/jpeg");
    }
    if is_webp(bytes) {
        return Some("image/webp");
    }
    None
}

fn read_size_limit_from_env(var_name: &str, default: usize) -> usize {
    match std::env::var(var_name) {
        Ok(raw) => raw
            .trim()
            .parse::<usize>()
            .ok()
            .filter(|value| *value > 0)
            .unwrap_or(default),
        Err(_) => default,
    }
}

fn is_png(bytes: &[u8]) -> bool {
    bytes.starts_with(b"\x89PNG\r\n\x1a\n")
}

fn is_jpeg(bytes: &[u8]) -> bool {
    bytes.starts_with(&[0xff, 0xd8, 0xff])
}

fn is_webp(bytes: &[u8]) -> bool {
    bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP"
}

pub fn create_executable_command(
    input: CreateExecutableInput,
    luthier_core: &dyn LuthierCorePort,
    base_binary_resolver: &dyn BaseBinaryResolverPort,
    logger: &dyn BackendLoggerPort,
) -> CommandStringResult<CreateExecutableOutput> {
    CreateExecutableUseCase::new(luthier_core, base_binary_resolver, logger)
        .execute_command_string(input)
}

pub fn create_executable_with_base_hints_command(
    input: CreateExecutableInput,
    base_binary_hints: &[PathBuf],
    luthier_core: &dyn LuthierCorePort,
    base_binary_resolver: &dyn BaseBinaryResolverPort,
    logger: &dyn BackendLoggerPort,
) -> CommandStringResult<CreateExecutableOutput> {
    CreateExecutableUseCase::new(luthier_core, base_binary_resolver, logger)
        .execute_with_base_hints_command_string(input, base_binary_hints)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_supported_hero_image_mime_signatures() {
        assert!(validate_optional_hero_image_bytes(Some(b"\x89PNG\r\n\x1a\nabc")).is_ok());
        assert!(validate_optional_hero_image_bytes(Some(&[0xff, 0xd8, 0xff, 0xe0])).is_ok());
        assert!(validate_optional_hero_image_bytes(Some(b"RIFFxxxxWEBP")).is_ok());
    }

    #[test]
    fn rejects_unsupported_hero_image_mime_signature() {
        let err =
            validate_optional_hero_image_bytes(Some(b"GIF89a")).expect_err("gif must be rejected");
        assert_eq!(err.code(), "hero_image_unsupported_mime");
    }

    #[test]
    fn rejects_non_png_icon_asset() {
        let err =
            validate_optional_icon_png_bytes(Some(&[0xff, 0xd8, 0xff])).expect_err("must fail");
        assert_eq!(err.code(), "icon_png_invalid_mime");
    }

    #[test]
    fn rejects_too_large_icon_asset() {
        let large_icon = vec![0_u8; DEFAULT_ICON_PNG_MAX_BYTES + 1];
        let err =
            validate_optional_icon_png_bytes(Some(&large_icon)).expect_err("must fail on size");
        assert_eq!(err.code(), "icon_png_too_large");
    }
}
