use std::collections::BTreeSet;
use std::env;
use std::time::Duration;

use reqwest::blocking::Client;
use reqwest::header::{HeaderName, HeaderValue};

use crate::application::ports::{
    HttpClientPort, HttpMethod, HttpRequest, HttpRequestBody, HttpResponse,
};
use crate::domain::validation as domain_validation;
use crate::error::{BackendError, BackendResult};
use crate::models::hero::{HeroSearchResult, PublicHeroSearchGame};

pub(crate) const HERO_SEARCH_ENDPOINT: &str = "https://steamgrid.usebottles.com/api/search/";
pub(crate) const STEAMGRIDDB_API_BASE: &str = "https://www.steamgriddb.com/api/v2";
pub(crate) const STEAMGRIDDB_PUBLIC_API_BASE: &str = "https://www.steamgriddb.com/api/public";

#[derive(Debug, Clone, Copy, Default)]
pub struct ReqwestBlockingHttpClient;

impl ReqwestBlockingHttpClient {
    pub fn new() -> Self {
        Self
    }
}

impl HttpClientPort for ReqwestBlockingHttpClient {
    fn send(&self, request: &HttpRequest) -> BackendResult<HttpResponse> {
        let mut client_builder = Client::builder();
        if let Some(timeout_ms) = request.timeout_ms {
            client_builder = client_builder.timeout(Duration::from_millis(timeout_ms));
        }
        let client = client_builder.build()?;

        let mut req = match request.method {
            HttpMethod::Get => client.get(&request.url),
            HttpMethod::Post => client.post(&request.url),
        };

        if !request.query.is_empty() {
            req = req.query(&request.query);
        }

        for (name, value) in &request.headers {
            let header_name = HeaderName::from_bytes(name.as_bytes()).map_err(|err| {
                BackendError::invalid_input(format!("invalid HTTP header name '{name}': {err}"))
                    .with_code("invalid_http_header_name")
            })?;
            let header_value = HeaderValue::from_str(value).map_err(|err| {
                BackendError::invalid_input(format!("invalid HTTP header value for '{name}': {err}"))
                    .with_code("invalid_http_header_value")
            })?;
            req = req.header(header_name, header_value);
        }

        req = match &request.body {
            HttpRequestBody::Empty => req,
            HttpRequestBody::Text(text) => req.body(text.clone()),
            HttpRequestBody::Bytes(bytes) => req.body(bytes.clone()),
            HttpRequestBody::Json(json) => req.json(json),
        };

        let response = req.send()?;
        let status_code = response.status().as_u16();
        let headers = response
            .headers()
            .iter()
            .map(|(name, value)| {
                (
                    name.as_str().to_string(),
                    String::from_utf8_lossy(value.as_bytes()).into_owned(),
                )
            })
            .collect::<Vec<_>>();
        let body = response.bytes()?.to_vec();

        Ok(HttpResponse {
            status_code,
            headers,
            body,
        })
    }
}

pub(crate) fn build_hero_search_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(4))
        .build()
        .map_err(|err| format!("failed to build HTTP client: {err}"))
}

pub(crate) fn fetch_remote_bytes(url: &str) -> Result<Vec<u8>, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|err| format!("failed to build HTTP client: {err}"))?;

    let response = client
        .get(url)
        .header(reqwest::header::USER_AGENT, "luthier/0.1 hero-image-fetch")
        .send()
        .map_err(|err| format!("failed to download hero image: {err}"))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("failed to download hero image (HTTP {status})"));
    }

    response
        .bytes()
        .map(|b| b.to_vec())
        .map_err(|err| format!("failed to read hero image bytes: {err}"))
}

pub(crate) fn search_hero_image_via_usebottles(
    game_name: &str,
    client: &Client,
) -> Result<HeroSearchResult, String> {
    let encoded_title = urlencoding::encode(game_name);
    let url = format!("{HERO_SEARCH_ENDPOINT}{encoded_title}");
    let response = client
        .get(&url)
        .header(reqwest::header::USER_AGENT, "luthier/0.1 hero-search")
        .send()
        .map_err(|err| format!("failed to query hero image search endpoint: {err}"))?;

    let status = response.status();
    let body = response
        .text()
        .map_err(|err| format!("failed to read hero search response: {err}"))?;

    if !status.is_success() {
        return Err(format!("hero image search failed with HTTP {status}"));
    }

    let image_url = domain_validation::parse_hero_search_response_url(&body)
        .ok_or_else(|| "hero image search returned an unsupported response".to_string())?;

    if !domain_validation::is_hero_image_url(&image_url) {
        return Err(
            "automatic search returned a grid image, not a hero image; configure STEAMGRIDDB_API_KEY (or LUTHIER_STEAMGRIDDB_API_KEY) to fetch SteamGridDB hero images".to_string(),
        );
    }

    Ok(HeroSearchResult {
        source: "steamgrid-usebottles-hero".to_string(),
        image_url: image_url.clone(),
        game_id: None,
        candidate_image_urls: vec![image_url],
    })
}

pub(crate) fn search_hero_image_via_steamgriddb_api(
    game_name: &str,
    client: &Client,
) -> Result<Option<HeroSearchResult>, String> {
    let Some(api_key) = read_steamgriddb_api_key() else {
        return Ok(None);
    };

    let encoded_title = urlencoding::encode(game_name);
    let search_url = format!("{STEAMGRIDDB_API_BASE}/search/autocomplete/{encoded_title}");
    let search_response = client
        .get(&search_url)
        .header(reqwest::header::AUTHORIZATION, format!("Bearer {api_key}"))
        .header(
            reqwest::header::USER_AGENT,
            "luthier/0.1 steamgriddb-hero-search",
        )
        .send()
        .map_err(|err| format!("failed to query SteamGridDB autocomplete: {err}"))?;

    let search_status = search_response.status();
    let search_json: serde_json::Value = search_response
        .json()
        .map_err(|err| format!("failed to decode SteamGridDB autocomplete response: {err}"))?;
    if !search_status.is_success() {
        return Err(format!(
            "SteamGridDB autocomplete failed with HTTP {search_status}"
        ));
    }

    let game_id = search_json
        .get("data")
        .and_then(|data| data.as_array())
        .and_then(|items| items.first())
        .and_then(|item| item.get("id"))
        .and_then(|id| id.as_u64())
        .ok_or_else(|| "SteamGridDB autocomplete returned no matching game".to_string())?;

    let heroes_url = format!("{STEAMGRIDDB_API_BASE}/heroes/game/{game_id}");
    let heroes_response = client
        .get(&heroes_url)
        .header(reqwest::header::AUTHORIZATION, format!("Bearer {api_key}"))
        .header(
            reqwest::header::USER_AGENT,
            "luthier/0.1 steamgriddb-hero-search",
        )
        .send()
        .map_err(|err| format!("failed to query SteamGridDB heroes: {err}"))?;

    let heroes_status = heroes_response.status();
    let heroes_json: serde_json::Value = heroes_response
        .json()
        .map_err(|err| format!("failed to decode SteamGridDB heroes response: {err}"))?;
    if !heroes_status.is_success() {
        return Err(format!(
            "SteamGridDB heroes lookup failed with HTTP {heroes_status}"
        ));
    }

    let hero_urls = collect_steamgriddb_hero_urls(
        heroes_json
            .get("data")
            .and_then(|data| data.as_array())
            .into_iter()
            .flatten(),
    );
    let hero_url = hero_urls
        .first()
        .cloned()
        .ok_or_else(|| "SteamGridDB heroes lookup returned no hero image".to_string())?;

    Ok(Some(HeroSearchResult {
        source: "steamgriddb-api-hero".to_string(),
        image_url: hero_url,
        game_id: Some(game_id),
        candidate_image_urls: hero_urls,
    }))
}

pub(crate) fn search_hero_image_via_steamgriddb_public(
    game_name: &str,
    client: &Client,
) -> Result<Option<HeroSearchResult>, String> {
    let autocomplete_game_id = search_steamgriddb_public_autocomplete_game_id(game_name, client)?;
    let header_hero_url = if let Some(game_id) = autocomplete_game_id {
        fetch_steamgriddb_public_game_header_hero(game_id, client)?
    } else {
        None
    };

    let search_games = match search_steamgriddb_public_hero_games(game_name, client) {
        Ok(games) => games,
        Err(_) if header_hero_url.is_some() => Vec::new(),
        Err(err) => return Err(err),
    };
    let matched_game = if let Some(game_id) = autocomplete_game_id {
        search_games
            .iter()
            .find(|game| game.game_id == game_id)
            .cloned()
    } else {
        None
    };
    let selected_search_game = matched_game.or_else(|| search_games.first().cloned());

    let selected_game_id =
        autocomplete_game_id.or_else(|| selected_search_game.as_ref().map(|g| g.game_id));
    let mut candidate_urls = Vec::new();
    if let Some(url) = header_hero_url.clone() {
        candidate_urls.push(url);
    }
    if let Some(game) = selected_search_game {
        candidate_urls.extend(game.hero_urls);
    }
    let candidate_urls = dedupe_urls_preserve_order(candidate_urls);

    let image_url = header_hero_url
        .or_else(|| candidate_urls.first().cloned())
        .ok_or_else(|| "SteamGridDB public hero search returned no hero image".to_string())?;

    Ok(Some(HeroSearchResult {
        source: "steamgriddb-public-hero".to_string(),
        image_url,
        game_id: selected_game_id,
        candidate_image_urls: candidate_urls,
    }))
}

fn search_steamgriddb_public_hero_games(
    game_name: &str,
    client: &Client,
) -> Result<Vec<PublicHeroSearchGame>, String> {
    let search_url = format!("{STEAMGRIDDB_PUBLIC_API_BASE}/search/main/games");
    let search_response = client
        .post(&search_url)
        .header(reqwest::header::ACCEPT, "application/json, text/plain, */*")
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .header(reqwest::header::ORIGIN, "https://www.steamgriddb.com")
        .header(
            reqwest::header::REFERER,
            "https://www.steamgriddb.com/search/heroes",
        )
        .header(
            reqwest::header::USER_AGENT,
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        )
        .json(&serde_json::json!({
            "asset_type": "hero",
            "term": game_name,
            "offset": 0,
            "filters": {
                "styles": ["all"],
                "dimensions": ["all"],
                "type": ["all"],
                "order": "score_desc"
            }
        }))
        .send()
        .map_err(|err| format!("failed to query SteamGridDB public hero search: {err}"))?;

    let search_status = search_response.status();
    let search_json: serde_json::Value = search_response.json().map_err(|err| {
        format!("failed to decode SteamGridDB public hero search response: {err}")
    })?;
    if !search_status.is_success() {
        return Err(format!(
            "SteamGridDB public hero search failed with HTTP {search_status}"
        ));
    }
    if search_json
        .get("success")
        .and_then(|v| v.as_bool())
        .is_some_and(|ok| !ok)
    {
        return Err("SteamGridDB public hero search returned success=false".to_string());
    }

    let Some(games) = search_json
        .get("data")
        .and_then(|v| v.get("games"))
        .and_then(|v| v.as_array())
    else {
        return Ok(Vec::new());
    };

    let mut out = Vec::new();
    for game in games {
        let Some(game_id) = game
            .get("game")
            .and_then(|v| v.get("id"))
            .and_then(|v| v.as_u64())
        else {
            continue;
        };
        let hero_urls = collect_steamgriddb_hero_urls(
            game.get("assets")
                .and_then(|v| v.as_array())
                .into_iter()
                .flatten(),
        );
        if hero_urls.is_empty() {
            continue;
        }
        out.push(PublicHeroSearchGame { game_id, hero_urls });
    }

    Ok(out)
}

fn search_steamgriddb_public_autocomplete_game_id(
    game_name: &str,
    client: &Client,
) -> Result<Option<u64>, String> {
    let search_url = format!("{STEAMGRIDDB_PUBLIC_API_BASE}/search/autocomplete");
    let response = client
        .get(&search_url)
        .header(reqwest::header::ACCEPT, "application/json, text/plain, */*")
        .header(reqwest::header::REFERER, "https://www.steamgriddb.com/")
        .header(
            reqwest::header::USER_AGENT,
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        )
        .query(&[("term", game_name)])
        .send()
        .map_err(|err| format!("failed to query SteamGridDB public autocomplete: {err}"))?;

    let status = response.status();
    let json: serde_json::Value = response.json().map_err(|err| {
        format!("failed to decode SteamGridDB public autocomplete response: {err}")
    })?;

    if !status.is_success() {
        return Err(format!(
            "SteamGridDB public autocomplete failed with HTTP {status}"
        ));
    }
    if json
        .get("success")
        .and_then(|v| v.as_bool())
        .is_some_and(|ok| !ok)
    {
        return Err("SteamGridDB public autocomplete returned success=false".to_string());
    }

    let games = json
        .get("data")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "SteamGridDB public autocomplete returned no data list".to_string())?;

    let game_id = games
        .first()
        .and_then(|game| game.get("id"))
        .and_then(|v| v.as_u64());

    Ok(game_id)
}

fn fetch_steamgriddb_public_game_header_hero(
    game_id: u64,
    client: &Client,
) -> Result<Option<String>, String> {
    let game_url = format!("{STEAMGRIDDB_PUBLIC_API_BASE}/game/{game_id}");
    let game_response = client
        .get(&game_url)
        .header(reqwest::header::ACCEPT, "application/json, text/plain, */*")
        .header(
            reqwest::header::REFERER,
            format!("https://www.steamgriddb.com/game/{game_id}/heroes"),
        )
        .header(
            reqwest::header::USER_AGENT,
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        )
        .send()
        .map_err(|err| format!("failed to query SteamGridDB public game endpoint: {err}"))?;

    let game_status = game_response.status();
    let game_json: serde_json::Value = game_response
        .json()
        .map_err(|err| format!("failed to decode SteamGridDB public game response: {err}"))?;

    if !game_status.is_success() {
        return Ok(None);
    }
    if !game_json
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Ok(None);
    }

    Ok(game_json
        .get("data")
        .and_then(|v| v.get("header"))
        .and_then(|v| v.get("asset"))
        .and_then(extract_steamgriddb_hero_url))
}

pub(crate) fn read_steamgriddb_api_key() -> Option<String> {
    for key in ["STEAMGRIDDB_API_KEY", "LUTHIER_STEAMGRIDDB_API_KEY"] {
        if let Ok(value) = env::var(key) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

fn collect_steamgriddb_hero_urls<'a>(
    items: impl IntoIterator<Item = &'a serde_json::Value>,
) -> Vec<String> {
    dedupe_urls_preserve_order(items.into_iter().filter_map(extract_steamgriddb_hero_url))
}

fn dedupe_urls_preserve_order(urls: impl IntoIterator<Item = String>) -> Vec<String> {
    let mut seen = BTreeSet::new();
    let mut out = Vec::new();
    for url in urls {
        if seen.insert(url.clone()) {
            out.push(url);
        }
    }
    out
}

fn extract_steamgriddb_hero_url(item: &serde_json::Value) -> Option<String> {
    for candidate in [
        item.get("thumb"),
        item.get("url"),
        item.get("thumbnail"),
        item.get("image"),
    ] {
        if let Some(value) = candidate {
            if let Some(url) = value.as_str() {
                if domain_validation::validate_hero_http_url(url).is_some()
                    && domain_validation::is_hero_image_url(url)
                {
                    return Some(url.to_string());
                }
            }
            if let Some(obj) = value.as_object() {
                for key in ["url", "thumb", "small", "medium", "large"] {
                    if let Some(url) = obj.get(key).and_then(|v| v.as_str()) {
                        if domain_validation::validate_hero_http_url(url).is_some()
                            && domain_validation::is_hero_image_url(url)
                        {
                            return Some(url.to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

