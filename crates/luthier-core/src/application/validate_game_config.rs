use luthier_orchestrator_core::GameConfig;

use crate::domain::validation_rules as domain_validation_rules;
use crate::{ConfigValidationIssue, LuthierError};

pub(crate) fn validate_game_config_relative_paths(config: &GameConfig) -> Result<(), LuthierError> {
    domain_validation_rules::validate_game_config_relative_paths(config)
}

pub(crate) fn collect_game_config_validation_issues(
    config: &GameConfig,
) -> Vec<ConfigValidationIssue> {
    domain_validation_rules::collect_game_config_validation_issues(config)
}

pub(crate) fn validate_game_config(config: &GameConfig) -> Result<(), LuthierError> {
    let issues = collect_game_config_validation_issues(config);
    if issues.is_empty() {
        Ok(())
    } else {
        Err(LuthierError::invalid_game_config(issues))
    }
}
