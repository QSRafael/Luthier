#[derive(Debug, Clone)]
pub(crate) struct HeroSearchResult {
    pub(crate) source: String,
    pub(crate) image_url: String,
    pub(crate) game_id: Option<u64>,
    pub(crate) candidate_image_urls: Vec<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct PublicHeroSearchGame {
    pub(crate) game_id: u64,
    pub(crate) hero_urls: Vec<String>,
}
