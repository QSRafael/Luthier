use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::OrchestratorError;

pub const CONTAINER_MAGIC: &[u8] = b"GOASv2";
const MANIFEST_LEN_BYTES: usize = 8;
const SHA256_BYTES: usize = 32;
const FOOTER_BYTES: usize = CONTAINER_MAGIC.len() + MANIFEST_LEN_BYTES + SHA256_BYTES;
const CONTAINER_VERSION: u32 = 2;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssetType {
    ConfigJson,
    HeroImage,
    IconPng,
}

impl AssetType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ConfigJson => "config_json",
            Self::HeroImage => "hero_image",
            Self::IconPng => "icon_png",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetManifestEntry {
    #[serde(rename = "type")]
    pub asset_type: AssetType,
    pub offset: u64,
    pub len: u64,
    pub sha256_hex: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetManifest {
    pub version: u32,
    pub entries: Vec<AssetManifestEntry>,
}

#[derive(Debug, Clone, Copy)]
pub struct AssetContainerWriteInput<'a> {
    pub config_json: &'a [u8],
    pub hero_image: Option<&'a [u8]>,
    pub icon_png: Option<&'a [u8]>,
}

#[derive(Debug, Clone)]
pub struct ParsedAssetContainer<'a> {
    pub manifest: AssetManifest,
    config_json: &'a [u8],
    hero_image: Option<&'a [u8]>,
    icon_png: Option<&'a [u8]>,
}

impl<'a> ParsedAssetContainer<'a> {
    pub fn config_json(&self) -> &'a [u8] {
        self.config_json
    }

    pub fn hero_image(&self) -> Option<&'a [u8]> {
        self.hero_image
    }

    pub fn icon_png(&self) -> Option<&'a [u8]> {
        self.icon_png
    }

    pub fn get(&self, asset_type: AssetType) -> Option<&'a [u8]> {
        match asset_type {
            AssetType::ConfigJson => Some(self.config_json),
            AssetType::HeroImage => self.hero_image,
            AssetType::IconPng => self.icon_png,
        }
    }
}

pub fn append_asset_container(
    base_binary: &[u8],
    input: AssetContainerWriteInput<'_>,
) -> Result<Vec<u8>, OrchestratorError> {
    if input.config_json.is_empty() {
        return Err(OrchestratorError::MissingRequiredAsset(
            AssetType::ConfigJson.as_str().to_string(),
        ));
    }

    let mut out = Vec::new();
    out.extend_from_slice(base_binary);

    let mut entries = Vec::with_capacity(3);
    append_asset(
        &mut out,
        &mut entries,
        AssetType::ConfigJson,
        input.config_json,
    )?;

    if let Some(bytes) = input.hero_image {
        if bytes.is_empty() {
            return Err(OrchestratorError::InvalidLength);
        }
        append_asset(&mut out, &mut entries, AssetType::HeroImage, bytes)?;
    }

    if let Some(bytes) = input.icon_png {
        if bytes.is_empty() {
            return Err(OrchestratorError::InvalidLength);
        }
        append_asset(&mut out, &mut entries, AssetType::IconPng, bytes)?;
    }

    let manifest = AssetManifest {
        version: CONTAINER_VERSION,
        entries,
    };
    let manifest_bytes = serde_json::to_vec(&manifest)?;
    let manifest_len =
        u64::try_from(manifest_bytes.len()).map_err(|_| OrchestratorError::InvalidLength)?;
    let manifest_checksum = sha256(&manifest_bytes);

    out.extend_from_slice(&manifest_bytes);
    out.extend_from_slice(CONTAINER_MAGIC);
    out.extend_from_slice(&manifest_len.to_le_bytes());
    out.extend_from_slice(&manifest_checksum);

    Ok(out)
}

pub fn parse_asset_container(binary: &[u8]) -> Result<ParsedAssetContainer<'_>, OrchestratorError> {
    if binary.len() < FOOTER_BYTES {
        return Err(OrchestratorError::ContainerTruncated);
    }

    let footer_start = binary
        .len()
        .checked_sub(FOOTER_BYTES)
        .ok_or(OrchestratorError::ContainerTruncated)?;
    let magic_start = footer_start;
    let magic_end = magic_start + CONTAINER_MAGIC.len();
    if &binary[magic_start..magic_end] != CONTAINER_MAGIC {
        return Err(OrchestratorError::ContainerNotFound);
    }

    let manifest_len_start = magic_end;
    let manifest_len_end = manifest_len_start + MANIFEST_LEN_BYTES;
    let mut manifest_len_bytes = [0_u8; MANIFEST_LEN_BYTES];
    manifest_len_bytes.copy_from_slice(&binary[manifest_len_start..manifest_len_end]);
    let manifest_len_u64 = u64::from_le_bytes(manifest_len_bytes);
    let manifest_len =
        usize::try_from(manifest_len_u64).map_err(|_| OrchestratorError::InvalidLength)?;
    if manifest_len > footer_start {
        return Err(OrchestratorError::InvalidLength);
    }

    let manifest_start = footer_start - manifest_len;
    let manifest_bytes = &binary[manifest_start..footer_start];

    let expected_manifest_checksum = &binary[manifest_len_end..manifest_len_end + SHA256_BYTES];
    let actual_manifest_checksum = sha256(manifest_bytes);
    if actual_manifest_checksum != expected_manifest_checksum {
        return Err(OrchestratorError::InvalidChecksum);
    }

    let manifest: AssetManifest = serde_json::from_slice(manifest_bytes)
        .map_err(|err| OrchestratorError::InvalidManifest(err.to_string()))?;

    if manifest.version != CONTAINER_VERSION {
        return Err(OrchestratorError::InvalidManifestVersion(manifest.version));
    }

    let mut seen_config = false;
    let mut seen_hero = false;
    let mut seen_icon = false;
    let mut config_json: Option<&[u8]> = None;
    let mut hero_image: Option<&[u8]> = None;
    let mut icon_png: Option<&[u8]> = None;

    for entry in &manifest.entries {
        let already_seen = match entry.asset_type {
            AssetType::ConfigJson => {
                if seen_config {
                    true
                } else {
                    seen_config = true;
                    false
                }
            }
            AssetType::HeroImage => {
                if seen_hero {
                    true
                } else {
                    seen_hero = true;
                    false
                }
            }
            AssetType::IconPng => {
                if seen_icon {
                    true
                } else {
                    seen_icon = true;
                    false
                }
            }
        };
        if already_seen {
            return Err(OrchestratorError::DuplicateAssetType(
                entry.asset_type.as_str().to_string(),
            ));
        }

        let asset_offset =
            usize::try_from(entry.offset).map_err(|_| OrchestratorError::InvalidLength)?;
        let asset_len = usize::try_from(entry.len).map_err(|_| OrchestratorError::InvalidLength)?;
        let asset_end = asset_offset
            .checked_add(asset_len)
            .ok_or(OrchestratorError::InvalidLength)?;

        if asset_end > manifest_start {
            return Err(OrchestratorError::AssetOutOfBounds(
                entry.asset_type.as_str().to_string(),
            ));
        }

        let asset_bytes = &binary[asset_offset..asset_end];
        let expected_asset_checksum = parse_sha256_hex(&entry.sha256_hex)?;
        let actual_asset_checksum = sha256(asset_bytes);
        if expected_asset_checksum != actual_asset_checksum {
            return Err(OrchestratorError::InvalidChecksum);
        }

        match entry.asset_type {
            AssetType::ConfigJson => {
                config_json = Some(asset_bytes);
            }
            AssetType::HeroImage => {
                hero_image = Some(asset_bytes);
            }
            AssetType::IconPng => {
                icon_png = Some(asset_bytes);
            }
        }
    }

    let config_json = config_json.ok_or_else(|| {
        OrchestratorError::MissingRequiredAsset(AssetType::ConfigJson.as_str().to_string())
    })?;

    Ok(ParsedAssetContainer {
        manifest,
        config_json,
        hero_image,
        icon_png,
    })
}

fn append_asset(
    out: &mut Vec<u8>,
    entries: &mut Vec<AssetManifestEntry>,
    asset_type: AssetType,
    bytes: &[u8],
) -> Result<(), OrchestratorError> {
    let offset = u64::try_from(out.len()).map_err(|_| OrchestratorError::InvalidLength)?;
    let len = u64::try_from(bytes.len()).map_err(|_| OrchestratorError::InvalidLength)?;
    out.extend_from_slice(bytes);
    entries.push(AssetManifestEntry {
        asset_type,
        offset,
        len,
        sha256_hex: to_lower_hex(&sha256(bytes)),
    });
    Ok(())
}

fn sha256(bytes: &[u8]) -> [u8; SHA256_BYTES] {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hasher.finalize().into()
}

fn to_lower_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(HEX[(b >> 4) as usize] as char);
        out.push(HEX[(b & 0x0f) as usize] as char);
    }
    out
}

fn parse_sha256_hex(raw: &str) -> Result<[u8; SHA256_BYTES], OrchestratorError> {
    let trimmed = raw.trim();
    if trimmed.len() != SHA256_BYTES * 2 {
        return Err(OrchestratorError::InvalidManifest(
            "asset checksum must be a 64-char sha256 hex string".to_string(),
        ));
    }

    let mut out = [0_u8; SHA256_BYTES];
    let bytes = trimmed.as_bytes();
    for idx in 0..SHA256_BYTES {
        let hi = from_hex_nibble(bytes[idx * 2]).ok_or_else(|| {
            OrchestratorError::InvalidManifest("asset checksum contains invalid hex".to_string())
        })?;
        let lo = from_hex_nibble(bytes[idx * 2 + 1]).ok_or_else(|| {
            OrchestratorError::InvalidManifest("asset checksum contains invalid hex".to_string())
        })?;
        out[idx] = (hi << 4) | lo;
    }
    Ok(out)
}

fn from_hex_nibble(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_binary_with_all_assets() -> Vec<u8> {
        append_asset_container(
            b"ELF-MOCK",
            AssetContainerWriteInput {
                config_json: br#"{"config_version":1}"#,
                hero_image: Some(b"hero-image-bytes"),
                icon_png: Some(b"\x89PNG\r\n\x1a\nicon"),
            },
        )
        .expect("container build should succeed")
    }

    fn replace_manifest(binary: &[u8], manifest: &AssetManifest) -> Vec<u8> {
        let manifest_bytes = serde_json::to_vec(manifest).expect("serialize manifest");
        replace_manifest_bytes(binary, &manifest_bytes)
    }

    fn replace_manifest_bytes(binary: &[u8], manifest_bytes: &[u8]) -> Vec<u8> {
        let footer_start = binary
            .len()
            .checked_sub(FOOTER_BYTES)
            .expect("must have footer");
        let magic_start = footer_start;
        let magic_end = magic_start + CONTAINER_MAGIC.len();
        let manifest_len_start = magic_end;
        let manifest_len_end = manifest_len_start + MANIFEST_LEN_BYTES;
        let mut manifest_len_bytes = [0_u8; MANIFEST_LEN_BYTES];
        manifest_len_bytes.copy_from_slice(&binary[manifest_len_start..manifest_len_end]);
        let manifest_len = usize::try_from(u64::from_le_bytes(manifest_len_bytes)).expect("len");
        let manifest_start = footer_start - manifest_len;

        let mut out = Vec::new();
        out.extend_from_slice(&binary[..manifest_start]);
        let manifest_checksum = sha256(manifest_bytes);
        out.extend_from_slice(manifest_bytes);
        out.extend_from_slice(CONTAINER_MAGIC);
        out.extend_from_slice(
            &u64::try_from(manifest_bytes.len())
                .expect("manifest len")
                .to_le_bytes(),
        );
        out.extend_from_slice(&manifest_checksum);
        out
    }

    #[test]
    fn parses_happy_path_with_three_assets() {
        let binary = sample_binary_with_all_assets();
        let parsed = parse_asset_container(&binary).expect("parse");

        assert_eq!(parsed.manifest.version, 2);
        assert_eq!(parsed.manifest.entries.len(), 3);
        assert_eq!(parsed.config_json(), br#"{"config_version":1}"#);
        assert_eq!(parsed.hero_image(), Some(&b"hero-image-bytes"[..]));
        assert_eq!(parsed.icon_png(), Some(&b"\x89PNG\r\n\x1a\nicon"[..]));
    }

    #[test]
    fn parses_without_optional_assets() {
        let binary = append_asset_container(
            b"ELF",
            AssetContainerWriteInput {
                config_json: br#"{"config_version":1}"#,
                hero_image: None,
                icon_png: None,
            },
        )
        .expect("container build");

        let parsed = parse_asset_container(&binary).expect("parse");
        assert_eq!(parsed.config_json(), br#"{"config_version":1}"#);
        assert!(parsed.hero_image().is_none());
        assert!(parsed.icon_png().is_none());
    }

    #[test]
    fn rejects_invalid_asset_type_in_manifest() {
        let binary = sample_binary_with_all_assets();
        let invalid_manifest_bytes = br#"{"version":2,"entries":[{"type":"arbitrary","offset":0,"len":1,"sha256_hex":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"}]}"#;
        let malformed = replace_manifest_bytes(&binary, invalid_manifest_bytes);

        let err = parse_asset_container(&malformed).expect_err("must reject invalid type");
        assert!(matches!(err, OrchestratorError::InvalidManifest(_)));
    }

    #[test]
    fn rejects_invalid_asset_checksum() {
        let mut binary = sample_binary_with_all_assets();
        binary[10] ^= 0x01;
        let err = parse_asset_container(&binary).expect_err("checksum must fail");
        assert!(matches!(err, OrchestratorError::InvalidChecksum));
    }

    #[test]
    fn rejects_invalid_offset_or_len() {
        let binary = sample_binary_with_all_assets();
        let mut manifest = parse_asset_container(&binary).expect("parse").manifest;
        manifest.entries[0].offset = u64::MAX;
        let malformed = replace_manifest(&binary, &manifest);
        let err = parse_asset_container(&malformed).expect_err("must fail on invalid offset");
        assert!(matches!(err, OrchestratorError::InvalidLength));
    }

    #[test]
    fn rejects_duplicate_asset_type() {
        let binary = sample_binary_with_all_assets();
        let mut manifest = parse_asset_container(&binary).expect("parse").manifest;
        manifest.entries.push(manifest.entries[0].clone());
        let malformed = replace_manifest(&binary, &manifest);
        let err = parse_asset_container(&malformed).expect_err("must reject duplicates");
        assert!(matches!(err, OrchestratorError::DuplicateAssetType(_)));
    }

    #[test]
    fn rejects_manifest_without_required_config_json() {
        let binary = sample_binary_with_all_assets();
        let mut manifest = parse_asset_container(&binary).expect("parse").manifest;
        manifest
            .entries
            .retain(|entry| entry.asset_type != AssetType::ConfigJson);
        let malformed = replace_manifest(&binary, &manifest);
        let err = parse_asset_container(&malformed).expect_err("must require config");
        assert!(matches!(err, OrchestratorError::MissingRequiredAsset(_)));
    }
}
