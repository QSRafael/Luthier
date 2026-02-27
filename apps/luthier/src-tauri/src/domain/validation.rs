use crate::error::{BackendError, BackendResult};

pub(crate) fn validate_search_hero_game_name<'a>(raw: &'a str) -> BackendResult<&'a str> {
    validate_trimmed_non_empty(raw, "game name is empty", "empty_game_name")
}

pub(crate) fn validate_prepare_hero_image_url_input<'a>(raw: &'a str) -> BackendResult<&'a str> {
    validate_trimmed_non_empty(raw, "hero image URL is empty", "empty_hero_image_url")
}

pub(crate) fn parse_hero_search_response_url(body: &str) -> Option<String> {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Ok(url) = serde_json::from_str::<String>(trimmed) {
        return validate_hero_http_url(&url).map(str::to_string);
    }

    validate_hero_http_url(trimmed).map(str::to_string)
}

pub(crate) fn validate_hero_http_url(raw: &str) -> Option<&str> {
    let trimmed = raw.trim();
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        Some(trimmed)
    } else {
        None
    }
}

pub(crate) fn is_hero_image_url(raw: &str) -> bool {
    let lower = raw.to_ascii_lowercase();
    lower.contains("/hero/")
        || lower.contains("/hero_thumb/")
        || lower.contains("/file/sgdb-cdn/hero/")
        || lower.contains("/file/sgdb-cdn/hero_thumb/")
}

fn validate_trimmed_non_empty<'a>(
    raw: &'a str,
    empty_message: &'static str,
    code: &'static str,
) -> BackendResult<&'a str> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(BackendError::invalid_input(empty_message).with_code(code));
    }
    Ok(trimmed)
}
