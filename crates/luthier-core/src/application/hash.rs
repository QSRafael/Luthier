use std::fs;
use std::path::Path;

use sha2::{Digest, Sha256};

use crate::LuthierError;

pub(crate) fn sha256_file(path: &Path) -> Result<String, LuthierError> {
    let bytes = fs::read(path)?;
    Ok(sha256_hex(&bytes))
}

pub(crate) fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest: [u8; 32] = hasher.finalize().into();
    let mut out = String::with_capacity(64);

    for byte in digest {
        out.push(hex_digit(byte >> 4));
        out.push(hex_digit(byte & 0x0f));
    }

    out
}

fn hex_digit(value: u8) -> char {
    match value {
        0..=9 => (b'0' + value) as char,
        _ => (b'a' + (value - 10)) as char,
    }
}
