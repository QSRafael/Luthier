use crate::error::{BackendResult, BackendResultExt, CommandStringResult};
use crate::infrastructure::{
    logging::log_backend_event,
    winetricks_catalog::{self, WinetricksCatalogLoadResult},
};
use crate::models::dto::WinetricksAvailableOutput;

#[derive(Debug, Clone, Copy, Default)]
pub struct WinetricksAvailableUseCase;

impl WinetricksAvailableUseCase {
    pub fn new() -> Self {
        Self
    }

    pub fn execute(&self) -> BackendResult<WinetricksAvailableOutput> {
        log_backend_event(
            "INFO",
            "GO-CR-301",
            "winetricks_catalog_requested",
            serde_json::json!({}),
        );

        let loaded = winetricks_catalog::load_winetricks_catalog()?;
        self.log_outcome(&loaded);

        Ok(loaded.output)
    }

    pub fn execute_command_string(&self) -> CommandStringResult<WinetricksAvailableOutput> {
        self.execute().into_command_string_result()
    }

    fn log_outcome(&self, loaded: &WinetricksCatalogLoadResult) {
        match (&loaded.output.source[..], &loaded.binary_path) {
            ("fallback", None) => {
                log_backend_event(
                    "WARN",
                    "GO-CR-302",
                    "winetricks_not_found_using_fallback_catalog",
                    serde_json::json!({ "components_count": loaded.output.components.len() }),
                );
            }
            ("fallback", Some(binary)) => {
                log_backend_event(
                    "WARN",
                    "GO-CR-303",
                    "winetricks_catalog_parse_empty_using_fallback",
                    serde_json::json!({
                        "binary": binary,
                        "components_count": loaded.output.components.len(),
                    }),
                );
            }
            ("winetricks", Some(binary)) => {
                log_backend_event(
                    "INFO",
                    "GO-CR-304",
                    "winetricks_catalog_loaded",
                    serde_json::json!({
                        "binary": binary,
                        "components_count": loaded.output.components.len(),
                    }),
                );
            }
            (_, binary) => {
                log_backend_event(
                    "INFO",
                    "GO-CR-304",
                    "winetricks_catalog_loaded",
                    serde_json::json!({
                        "binary": binary,
                        "components_count": loaded.output.components.len(),
                        "source": &loaded.output.source,
                    }),
                );
            }
        }
    }
}

pub fn winetricks_available() -> BackendResult<WinetricksAvailableOutput> {
    WinetricksAvailableUseCase::new().execute()
}

pub fn winetricks_available_command() -> CommandStringResult<WinetricksAvailableOutput> {
    WinetricksAvailableUseCase::new().execute_command_string()
}
