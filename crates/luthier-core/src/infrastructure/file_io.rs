use std::fs;
use std::path::Path;

use crate::LuthierError;

pub(crate) fn read_bytes(path: &Path) -> Result<Vec<u8>, LuthierError> {
    fs::read(path).map_err(LuthierError::from)
}
