pub const EMBEDDED_SPLASH_FONT_BYTES: &[u8] =
    include_bytes!("../../assets/fonts/NotoSans-Regular.ttf");

pub fn embedded_splash_font_bytes() -> &'static [u8] {
    EMBEDDED_SPLASH_FONT_BYTES
}
