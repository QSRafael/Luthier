use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::application::ports::WinetricksCatalogParserPort;
use crate::infrastructure::fs_repo;
use crate::models::dto::WinetricksAvailableOutput;

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

#[derive(Debug, Clone)]
pub(crate) struct WinetricksCatalogLoadResult {
    pub(crate) output: WinetricksAvailableOutput,
    pub(crate) binary_path: Option<PathBuf>,
}

pub(crate) fn load_winetricks_catalog() -> Result<WinetricksCatalogLoadResult, String> {
    let fallback = fallback_winetricks_components();

    let Some(binary) = fs_repo::find_executable_in_path("winetricks") else {
        return Ok(WinetricksCatalogLoadResult {
            output: WinetricksAvailableOutput {
                source: "fallback".to_string(),
                components: fallback,
            },
            binary_path: None,
        });
    };

    let parsed = load_winetricks_catalog_from_binary(&binary)?;
    if parsed.is_empty() {
        return Ok(WinetricksCatalogLoadResult {
            output: WinetricksAvailableOutput {
                source: "fallback".to_string(),
                components: fallback,
            },
            binary_path: Some(binary),
        });
    }

    Ok(WinetricksCatalogLoadResult {
        output: WinetricksAvailableOutput {
            source: "winetricks".to_string(),
            components: parsed,
        },
        binary_path: Some(binary),
    })
}

pub(crate) fn load_winetricks_catalog_from_binary(binary: &Path) -> Result<Vec<String>, String> {
    let mut components = BTreeSet::new();

    for args in &[["dlls", "list"], ["fonts", "list"]] {
        let output = Command::new(binary)
            .args(args)
            .output()
            .map_err(|err| format!("failed to execute winetricks: {err}"))?;

        if !output.status.success() {
            continue;
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        for component in parse_winetricks_components(&stdout) {
            components.insert(component);
        }
    }

    Ok(components.into_iter().collect())
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

