use sha2::{Digest, Sha256};

use crate::error::OrchestratorError;

pub const TRAILER_MAGIC: &[u8] = b"GOCFGv1";
const JSON_LEN_BYTES: usize = 8;
const SHA256_BYTES: usize = 32;
const TRAILER_BYTES: usize = TRAILER_MAGIC.len() + JSON_LEN_BYTES + SHA256_BYTES;

pub fn append_config(base_binary: &[u8], config_json: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(base_binary.len() + config_json.len() + TRAILER_BYTES);
    out.extend_from_slice(base_binary);
    out.extend_from_slice(config_json);
    out.extend_from_slice(TRAILER_MAGIC);

    let len = config_json.len() as u64;
    out.extend_from_slice(&len.to_le_bytes());

    let checksum = sha256(config_json);
    out.extend_from_slice(&checksum);

    out
}

pub fn extract_config_json(binary: &[u8]) -> Result<&[u8], OrchestratorError> {
    if binary.len() < TRAILER_BYTES {
        return Err(OrchestratorError::TrailerTruncated);
    }

    let trailer_start = binary.len() - TRAILER_BYTES;
    let magic_start = trailer_start;
    let magic_end = magic_start + TRAILER_MAGIC.len();

    if &binary[magic_start..magic_end] != TRAILER_MAGIC {
        return Err(OrchestratorError::TrailerNotFound);
    }

    let len_start = magic_end;
    let len_end = len_start + JSON_LEN_BYTES;
    let mut len_buf = [0_u8; JSON_LEN_BYTES];
    len_buf.copy_from_slice(&binary[len_start..len_end]);

    let config_len = u64::from_le_bytes(len_buf)
        .try_into()
        .map_err(|_| OrchestratorError::InvalidLength)?;

    if config_len > trailer_start {
        return Err(OrchestratorError::InvalidLength);
    }

    let json_start = trailer_start - config_len;
    let json_end = trailer_start;
    let json = &binary[json_start..json_end];

    let checksum_start = len_end;
    let checksum_end = checksum_start + SHA256_BYTES;
    let expected_checksum = &binary[checksum_start..checksum_end];

    let actual_checksum = sha256(json);
    if actual_checksum != expected_checksum {
        return Err(OrchestratorError::InvalidChecksum);
    }

    Ok(json)
}

fn sha256(bytes: &[u8]) -> [u8; SHA256_BYTES] {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hasher.finalize().into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn appends_and_extracts_payload() {
        let base = b"ELF-MOCK";
        let json = br#"{"game_name":"AoE3"}"#;

        let injected = append_config(base, json);
        let extracted = extract_config_json(&injected).expect("extract payload");

        assert_eq!(extracted, json);
    }

    #[test]
    fn fails_when_magic_is_missing() {
        let bad = b"binary-without-trailer";
        let err = extract_config_json(bad).expect_err("should fail without trailer");
        assert!(matches!(
            err,
            OrchestratorError::TrailerNotFound | OrchestratorError::TrailerTruncated
        ));
    }

    #[test]
    fn fails_when_checksum_is_corrupted() {
        let mut injected = append_config(b"ELF", br#"{"foo":"bar"}"#);
        let idx = injected.len() - TRAILER_BYTES - 1;
        injected[idx] ^= 0x01;

        let err = extract_config_json(&injected).expect_err("should fail integrity");
        assert!(matches!(err, OrchestratorError::InvalidChecksum));
    }
}
