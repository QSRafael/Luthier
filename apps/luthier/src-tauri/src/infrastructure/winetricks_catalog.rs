use crate::application::ports::WinetricksCatalogParserPort;

#[derive(Debug, Clone, Copy, Default)]
pub struct WinetricksCatalogParser;

impl WinetricksCatalogParser {
    pub fn new() -> Self {
        Self
    }
}

impl WinetricksCatalogParserPort for WinetricksCatalogParser {
    fn parse_components(&self, raw: &str) -> Vec<String> {
        parse_winetricks_components(raw)
    }

    fn fallback_components(&self) -> Vec<String> {
        fallback_winetricks_components()
    }
}

pub(crate) fn parse_winetricks_components(raw: &str) -> Vec<String> {
    raw.lines()
        .filter_map(|line| {
            let entry = line.split_whitespace().next()?;
            if entry.starts_with('#') || entry.contains(':') {
                return None;
            }

            if entry
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.'))
            {
                Some(entry.to_string())
            } else {
                None
            }
        })
        .collect()
}

pub(crate) fn fallback_winetricks_components() -> Vec<String> {
    [
        "corefonts",
        "d3dx9",
        "d3dcompiler_47",
        "dotnet48",
        "dxvk",
        "faudio",
        "galliumnine",
        "mf",
        "msxml3",
        "physx",
        "vcrun2005",
        "vcrun2008",
        "vcrun2010",
        "vcrun2013",
        "vcrun2019",
        "xact",
        "xinput",
    ]
    .iter()
    .map(|item| item.to_string())
    .collect()
}
