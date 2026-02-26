use std::sync::OnceLock;
use fontdb::{Database, Family, Query, Source, Style, Weight};
use fontdue::{Font, FontSettings};

pub const WIN_W: usize = 960;
pub const WIN_H: usize = 310;
pub const FPS: u64 = 60;
pub const PRELAUNCH_AUTOSTART_SECS: u64 = 10;

pub const BG: u32 = 0x000000;
pub const BORDER: u32 = 0x2a2a2a;
pub const TEXT: u32 = 0xffffff;
pub const MUTED: u32 = 0xbdbdbd;
pub const BAD: u32 = 0xffffff;
pub const BTN: u32 = 0x101010;
pub const BTN_HOVER: u32 = 0x181818;
pub const SEPARATOR: u32 = 0x1f1f1f;

static SYSTEM_FONT: OnceLock<Option<Font>> = OnceLock::new();
const EMBEDDED_SPLASH_FONT_BYTES: &[u8] = include_bytes!("../../assets/fonts/NotoSans-Regular.ttf");

pub fn system_font() -> Option<&'static Font> {
    SYSTEM_FONT
        .get_or_init(|| load_embedded_splash_font().or_else(load_system_font))
        .as_ref()
}

fn load_embedded_splash_font() -> Option<Font> {
    Font::from_bytes(EMBEDDED_SPLASH_FONT_BYTES, FontSettings::default()).ok()
}

fn load_system_font() -> Option<Font> {
    let mut db = Database::new();
    db.load_system_fonts();
    let families = [
        Family::Name("Noto Sans"),
        Family::Name("Cantarell"),
        Family::Name("DejaVu Sans"),
        Family::Name("Liberation Sans"),
        Family::SansSerif,
    ];
    let query = Query {
        families: &families,
        weight: Weight::NORMAL,
        style: Style::Normal,
        ..Query::default()
    };
    let id = db.query(&query)?;
    let face = db.face(id)?;

    let bytes = match &face.source {
        Source::Binary(data) => data.as_ref().as_ref().to_vec(),
        Source::File(path) => std::fs::read(path).ok()?,
        Source::SharedFile(path, _) => std::fs::read(path).ok()?,
    };

    Font::from_bytes(bytes, FontSettings::default()).ok()
}
