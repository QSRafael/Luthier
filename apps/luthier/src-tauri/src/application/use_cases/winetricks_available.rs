use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use crate::application::ports::{
    BackendLogEvent, BackendLogLevel, BackendLoggerPort, ExternalCommandRequest, FileSystemPort,
    ProcessRunnerPort, RuntimeEnvironmentPort, WinetricksCatalogParserPort,
};
use crate::error::{BackendResult, BackendResultExt, CommandStringResult};
use crate::models::dto::WinetricksAvailableOutput;

#[derive(Debug, Clone)]
struct WinetricksCatalogLoadResult {
    output: WinetricksAvailableOutput,
    binary_path: Option<PathBuf>,
}

pub struct WinetricksAvailableUseCase<'a> {
    process_runner: &'a dyn ProcessRunnerPort,
    runtime_environment: &'a dyn RuntimeEnvironmentPort,
    file_system: &'a dyn FileSystemPort,
    winetricks_catalog_parser: &'a dyn WinetricksCatalogParserPort,
    logger: &'a dyn BackendLoggerPort,
}

impl<'a> WinetricksAvailableUseCase<'a> {
    pub fn new(
        process_runner: &'a dyn ProcessRunnerPort,
        runtime_environment: &'a dyn RuntimeEnvironmentPort,
        file_system: &'a dyn FileSystemPort,
        winetricks_catalog_parser: &'a dyn WinetricksCatalogParserPort,
        logger: &'a dyn BackendLoggerPort,
    ) -> Self {
        Self {
            process_runner,
            runtime_environment,
            file_system,
            winetricks_catalog_parser,
            logger,
        }
    }

    pub fn execute(&self) -> BackendResult<WinetricksAvailableOutput> {
        self.log_info(
            "GO-CR-301",
            "winetricks_catalog_requested",
            serde_json::json!({}),
        );

        let loaded = self.load_winetricks_catalog()?;
        self.log_outcome(&loaded);

        Ok(loaded.output)
    }

    pub fn execute_command_string(&self) -> CommandStringResult<WinetricksAvailableOutput> {
        self.execute().into_command_string_result()
    }

    fn load_winetricks_catalog(&self) -> BackendResult<WinetricksCatalogLoadResult> {
        let fallback = self.winetricks_catalog_parser.fallback_components();

        let Some(binary) = self.find_executable_in_path("winetricks") else {
            return Ok(WinetricksCatalogLoadResult {
                output: WinetricksAvailableOutput {
                    source: "fallback".to_string(),
                    components: fallback,
                },
                binary_path: None,
            });
        };

        let parsed = self.load_winetricks_catalog_from_binary(&binary)?;
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

    fn load_winetricks_catalog_from_binary(&self, binary: &Path) -> BackendResult<Vec<String>> {
        let mut components = BTreeSet::new();

        for args in [["dlls", "list"], ["fonts", "list"]] {
            let request = ExternalCommandRequest {
                program: binary.to_path_buf(),
                args: args.iter().map(|value| (*value).to_string()).collect(),
                env: Vec::new(),
                current_dir: None,
            };

            let output = self
                .process_runner
                .run(&request)
                .map_err(|err| err.with_context("failed to execute winetricks"))?;

            if !output.success {
                continue;
            }

            let stdout = String::from_utf8_lossy(&output.stdout);
            for component in self.winetricks_catalog_parser.parse_components(&stdout) {
                components.insert(component);
            }
        }

        Ok(components.into_iter().collect())
    }

    fn find_executable_in_path(&self, name: &str) -> Option<PathBuf> {
        for directory in self.runtime_environment.path_entries() {
            let candidate = directory.join(name);
            if self.file_system.is_file(&candidate) {
                return Some(candidate);
            }
        }
        None
    }

    fn log_outcome(&self, loaded: &WinetricksCatalogLoadResult) {
        match (&loaded.output.source[..], &loaded.binary_path) {
            ("fallback", None) => {
                self.log_warn(
                    "GO-CR-302",
                    "winetricks_not_found_using_fallback_catalog",
                    serde_json::json!({ "components_count": loaded.output.components.len() }),
                );
            }
            ("fallback", Some(binary)) => {
                self.log_warn(
                    "GO-CR-303",
                    "winetricks_catalog_parse_empty_using_fallback",
                    serde_json::json!({
                        "binary": binary,
                        "components_count": loaded.output.components.len(),
                    }),
                );
            }
            ("winetricks", Some(binary)) => {
                self.log_info(
                    "GO-CR-304",
                    "winetricks_catalog_loaded",
                    serde_json::json!({
                        "binary": binary,
                        "components_count": loaded.output.components.len(),
                    }),
                );
            }
            (_, binary) => {
                self.log_info(
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

    fn log_info(&self, event_code: &str, message: &str, context: serde_json::Value) {
        self.log(BackendLogLevel::Info, event_code, message, context);
    }

    fn log_warn(&self, event_code: &str, message: &str, context: serde_json::Value) {
        self.log(BackendLogLevel::Warn, event_code, message, context);
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

pub fn winetricks_available(
    process_runner: &dyn ProcessRunnerPort,
    runtime_environment: &dyn RuntimeEnvironmentPort,
    file_system: &dyn FileSystemPort,
    winetricks_catalog_parser: &dyn WinetricksCatalogParserPort,
    logger: &dyn BackendLoggerPort,
) -> BackendResult<WinetricksAvailableOutput> {
    WinetricksAvailableUseCase::new(
        process_runner,
        runtime_environment,
        file_system,
        winetricks_catalog_parser,
        logger,
    )
    .execute()
}

pub fn winetricks_available_command(
    process_runner: &dyn ProcessRunnerPort,
    runtime_environment: &dyn RuntimeEnvironmentPort,
    file_system: &dyn FileSystemPort,
    winetricks_catalog_parser: &dyn WinetricksCatalogParserPort,
    logger: &dyn BackendLoggerPort,
) -> CommandStringResult<WinetricksAvailableOutput> {
    WinetricksAvailableUseCase::new(
        process_runner,
        runtime_environment,
        file_system,
        winetricks_catalog_parser,
        logger,
    )
    .execute_command_string()
}
