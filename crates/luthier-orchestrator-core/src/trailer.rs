use sha2::{Digest, Sha256};

use crate::error::OrchestratorError;

pub const TRAILER_MAGIC: &[u8] = b"GOASv2";
const U16_BYTES: usize = 2;
const U64_BYTES: usize = 8;
const SHA256_BYTES: usize = 32;
const TRAILER_BYTES: usize = TRAILER_MAGIC.len() + U64_BYTES;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[repr(u8)]
pub enum AssetType {
    ConfigJson = 1,
    HeroImage = 2,
    IconPng = 3,
}

impl AssetType {
    fn from_tag(tag: u8) -> Option<Self> {
        match tag {
            1 => Some(Self::ConfigJson),
            2 => Some(Self::HeroImage),
            3 => Some(Self::IconPng),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ManifestEntry {
    pub asset_type: AssetType,
    pub offset: u64,
    pub len: u64,
    pub sha256: [u8; SHA256_BYTES],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PayloadManifest {
    pub entries: Vec<ManifestEntry>,
}

impl PayloadManifest {
    pub fn entry(&self, asset_type: AssetType) -> Option<&ManifestEntry> {
        self.entries
            .iter()
            .find(|entry| entry.asset_type == asset_type)
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct AssetBundleInput<'a> {
    pub config_json: &'a [u8],
    pub hero_image: Option<&'a [u8]>,
    pub icon_png: Option<&'a [u8]>,
}

#[derive(Debug, Clone)]
pub struct PayloadAssets {
    pub manifest: PayloadManifest,
    pub config_json: Vec<u8>,
    pub hero_image: Option<Vec<u8>>,
    pub icon_png: Option<Vec<u8>>,
}

pub fn append_asset_bundle(base_binary: &[u8], input: AssetBundleInput<'_>) -> Vec<u8> {
    let mut data = Vec::new();
    let mut entries = Vec::new();

    push_asset(
        &mut data,
        &mut entries,
        AssetType::ConfigJson,
        input.config_json,
    );
    if let Some(hero_image) = input.hero_image {
        push_asset(&mut data, &mut entries, AssetType::HeroImage, hero_image);
    }
    if let Some(icon_png) = input.icon_png {
        push_asset(&mut data, &mut entries, AssetType::IconPng, icon_png);
    }

    let base_offset = base_binary.len() as u64;
    for entry in &mut entries {
        entry.offset = entry.offset.saturating_add(base_offset);
    }

    let manifest = encode_manifest(&entries);

    let mut out =
        Vec::with_capacity(base_binary.len() + data.len() + manifest.len() + TRAILER_BYTES);
    out.extend_from_slice(base_binary);
    out.extend_from_slice(&data);
    out.extend_from_slice(&manifest);
    out.extend_from_slice(TRAILER_MAGIC);
    out.extend_from_slice(&(manifest.len() as u64).to_le_bytes());
    out
}

pub fn extract_asset_bundle(binary: &[u8]) -> Result<PayloadAssets, OrchestratorError> {
    let (manifest, manifest_start) = parse_manifest(binary)?;

    let config = extract_asset_bytes(binary, manifest_start, &manifest, AssetType::ConfigJson)?;
    let hero_image = extract_asset_bytes(binary, manifest_start, &manifest, AssetType::HeroImage)?;
    let icon_png = extract_asset_bytes(binary, manifest_start, &manifest, AssetType::IconPng)?;

    Ok(PayloadAssets {
        manifest,
        config_json: config.ok_or(OrchestratorError::MissingRequiredAsset(
            AssetType::ConfigJson,
        ))?,
        hero_image,
        icon_png,
    })
}

pub fn extract_config_json(binary: &[u8]) -> Result<&[u8], OrchestratorError> {
    let (manifest, manifest_start) = parse_manifest(binary)?;
    let config = get_asset_slice(binary, manifest_start, &manifest, AssetType::ConfigJson)?.ok_or(
        OrchestratorError::MissingRequiredAsset(AssetType::ConfigJson),
    )?;
    Ok(config)
}

pub fn read_manifest(binary: &[u8]) -> Result<PayloadManifest, OrchestratorError> {
    let (manifest, _) = parse_manifest(binary)?;
    Ok(manifest)
}

fn extract_asset_bytes(
    binary: &[u8],
    manifest_start: usize,
    manifest: &PayloadManifest,
    asset_type: AssetType,
) -> Result<Option<Vec<u8>>, OrchestratorError> {
    Ok(get_asset_slice(binary, manifest_start, manifest, asset_type)?.map(|slice| slice.to_vec()))
}

fn get_asset_slice<'a>(
    binary: &'a [u8],
    manifest_start: usize,
    manifest: &PayloadManifest,
    asset_type: AssetType,
) -> Result<Option<&'a [u8]>, OrchestratorError> {
    let Some(entry) = manifest.entry(asset_type) else {
        return Ok(None);
    };

    let start =
        usize::try_from(entry.offset).map_err(|_| OrchestratorError::InvalidManifestBounds)?;
    let len = usize::try_from(entry.len).map_err(|_| OrchestratorError::InvalidManifestBounds)?;

    let end = start
        .checked_add(len)
        .ok_or(OrchestratorError::InvalidManifestBounds)?;
    if end > manifest_start {
        return Err(OrchestratorError::InvalidManifestBounds);
    }

    let bytes = &binary[start..end];
    if sha256(bytes) != entry.sha256 {
        return Err(OrchestratorError::InvalidAssetChecksum(asset_type));
    }

    Ok(Some(bytes))
}

fn push_asset(
    data: &mut Vec<u8>,
    entries: &mut Vec<ManifestEntry>,
    asset_type: AssetType,
    bytes: &[u8],
) {
    let offset = data.len() as u64;
    data.extend_from_slice(bytes);
    entries.push(ManifestEntry {
        asset_type,
        offset,
        len: bytes.len() as u64,
        sha256: sha256(bytes),
    });
}

fn encode_manifest(entries: &[ManifestEntry]) -> Vec<u8> {
    let mut out =
        Vec::with_capacity(U16_BYTES + entries.len() * (1 + U64_BYTES + U64_BYTES + SHA256_BYTES));
    out.extend_from_slice(&(entries.len() as u16).to_le_bytes());
    for entry in entries {
        out.push(entry.asset_type as u8);
        out.extend_from_slice(&entry.offset.to_le_bytes());
        out.extend_from_slice(&entry.len.to_le_bytes());
        out.extend_from_slice(&entry.sha256);
    }
    out
}

fn parse_manifest(binary: &[u8]) -> Result<(PayloadManifest, usize), OrchestratorError> {
    if binary.len() < TRAILER_BYTES {
        return Err(OrchestratorError::TrailerTruncated);
    }

    let trailer_start = binary.len() - TRAILER_BYTES;
    if &binary[trailer_start..trailer_start + TRAILER_MAGIC.len()] != TRAILER_MAGIC {
        return Err(OrchestratorError::TrailerNotFound);
    }

    let len_start = trailer_start + TRAILER_MAGIC.len();
    let mut len_buf = [0_u8; U64_BYTES];
    len_buf.copy_from_slice(&binary[len_start..len_start + U64_BYTES]);
    let manifest_len_u64 = u64::from_le_bytes(len_buf);
    let manifest_len =
        usize::try_from(manifest_len_u64).map_err(|_| OrchestratorError::InvalidLength)?;

    if manifest_len > trailer_start {
        return Err(OrchestratorError::InvalidLength);
    }

    let manifest_start = trailer_start - manifest_len;
    let manifest_bytes = &binary[manifest_start..trailer_start];
    let manifest = decode_manifest(manifest_bytes, manifest_start)?;

    if manifest.entry(AssetType::ConfigJson).is_none() {
        return Err(OrchestratorError::MissingRequiredAsset(
            AssetType::ConfigJson,
        ));
    }

    Ok((manifest, manifest_start))
}

fn decode_manifest(
    bytes: &[u8],
    manifest_start: usize,
) -> Result<PayloadManifest, OrchestratorError> {
    if bytes.len() < U16_BYTES {
        return Err(OrchestratorError::TrailerTruncated);
    }

    let mut count_buf = [0_u8; U16_BYTES];
    count_buf.copy_from_slice(&bytes[0..U16_BYTES]);
    let entry_count = u16::from_le_bytes(count_buf) as usize;

    let entry_size = 1 + U64_BYTES + U64_BYTES + SHA256_BYTES;
    let expected_len = U16_BYTES
        .checked_add(
            entry_count
                .checked_mul(entry_size)
                .ok_or(OrchestratorError::InvalidLength)?,
        )
        .ok_or(OrchestratorError::InvalidLength)?;

    if expected_len != bytes.len() {
        return Err(OrchestratorError::InvalidLength);
    }

    let mut seen = std::collections::HashSet::new();
    let mut entries = Vec::with_capacity(entry_count);

    let mut cursor = U16_BYTES;
    for _ in 0..entry_count {
        let type_tag = bytes[cursor];
        cursor += 1;

        let asset_type =
            AssetType::from_tag(type_tag).ok_or(OrchestratorError::InvalidAssetType(type_tag))?;

        if !seen.insert(asset_type as u8) {
            return Err(OrchestratorError::DuplicateAssetType(asset_type));
        }

        let mut offset_buf = [0_u8; U64_BYTES];
        offset_buf.copy_from_slice(&bytes[cursor..cursor + U64_BYTES]);
        cursor += U64_BYTES;

        let mut len_buf = [0_u8; U64_BYTES];
        len_buf.copy_from_slice(&bytes[cursor..cursor + U64_BYTES]);
        cursor += U64_BYTES;

        let mut checksum = [0_u8; SHA256_BYTES];
        checksum.copy_from_slice(&bytes[cursor..cursor + SHA256_BYTES]);
        cursor += SHA256_BYTES;

        let offset = u64::from_le_bytes(offset_buf);
        let len = u64::from_le_bytes(len_buf);

        let offset_usize =
            usize::try_from(offset).map_err(|_| OrchestratorError::InvalidManifestBounds)?;
        let len_usize =
            usize::try_from(len).map_err(|_| OrchestratorError::InvalidManifestBounds)?;
        let end = offset_usize
            .checked_add(len_usize)
            .ok_or(OrchestratorError::InvalidManifestBounds)?;

        if end > manifest_start {
            return Err(OrchestratorError::InvalidManifestBounds);
        }

        entries.push(ManifestEntry {
            asset_type,
            offset,
            len,
            sha256: checksum,
        });
    }

    Ok(PayloadManifest { entries })
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
    fn happy_path_with_three_assets() {
        let injected = append_asset_bundle(
            b"ELF",
            AssetBundleInput {
                config_json: br#"{"game_name":"AoE3"}"#,
                hero_image: Some(b"WEBP"),
                icon_png: Some(b"PNG"),
            },
        );

        let assets = extract_asset_bundle(&injected).expect("extract assets");
        assert_eq!(assets.config_json, br#"{"game_name":"AoE3"}"#);
        assert_eq!(assets.hero_image.as_deref(), Some(b"WEBP".as_slice()));
        assert_eq!(assets.icon_png.as_deref(), Some(b"PNG".as_slice()));
    }

    #[test]
    fn works_without_optional_assets() {
        let injected = append_asset_bundle(
            b"ELF",
            AssetBundleInput {
                config_json: br#"{"a":1}"#,
                hero_image: None,
                icon_png: None,
            },
        );

        let assets = extract_asset_bundle(&injected).expect("extract assets");
        assert!(assets.hero_image.is_none());
        assert!(assets.icon_png.is_none());
    }

    #[test]
    fn fails_invalid_type() {
        let injected = append_asset_bundle(
            b"ELF",
            AssetBundleInput {
                config_json: br#"{"a":1}"#,
                hero_image: None,
                icon_png: None,
            },
        );
        let mut tampered = injected;
        let trailer_start = tampered.len() - TRAILER_BYTES;
        let manifest_len = u64::from_le_bytes(
            tampered[trailer_start + TRAILER_MAGIC.len()..]
                .try_into()
                .unwrap(),
        ) as usize;
        let manifest_start = trailer_start - manifest_len;
        tampered[manifest_start + U16_BYTES] = 99;

        let err = extract_asset_bundle(&tampered).expect_err("must fail");
        assert!(matches!(err, OrchestratorError::InvalidAssetType(99)));
    }

    #[test]
    fn fails_invalid_checksum() {
        let mut injected = append_asset_bundle(
            b"ELF",
            AssetBundleInput {
                config_json: br#"{"a":1}"#,
                hero_image: Some(b"hero"),
                icon_png: None,
            },
        );
        injected[3] ^= 0xFF;
        let err = extract_asset_bundle(&injected).expect_err("must fail");
        assert!(matches!(err, OrchestratorError::InvalidAssetChecksum(_)));
    }

    #[test]
    fn fails_invalid_offset_len() {
        let injected = append_asset_bundle(
            b"ELF",
            AssetBundleInput {
                config_json: br#"{"a":1}"#,
                hero_image: None,
                icon_png: None,
            },
        );
        let mut tampered = injected;
        let trailer_start = tampered.len() - TRAILER_BYTES;
        let manifest_len = u64::from_le_bytes(
            tampered[trailer_start + TRAILER_MAGIC.len()..]
                .try_into()
                .unwrap(),
        ) as usize;
        let manifest_start = trailer_start - manifest_len;
        let offset_start = manifest_start + U16_BYTES + 1;
        tampered[offset_start..offset_start + U64_BYTES].copy_from_slice(&(u64::MAX).to_le_bytes());

        let err = extract_asset_bundle(&tampered).expect_err("must fail");
        assert!(matches!(err, OrchestratorError::InvalidManifestBounds));
    }

    #[test]
    fn fails_duplicate_type() {
        let injected = append_asset_bundle(
            b"ELF",
            AssetBundleInput {
                config_json: br#"{"a":1}"#,
                hero_image: Some(b"hero"),
                icon_png: None,
            },
        );
        let mut tampered = injected;
        let trailer_start = tampered.len() - TRAILER_BYTES;
        let manifest_len = u64::from_le_bytes(
            tampered[trailer_start + TRAILER_MAGIC.len()..]
                .try_into()
                .unwrap(),
        ) as usize;
        let manifest_start = trailer_start - manifest_len;
        tampered[0 + manifest_start..manifest_start + U16_BYTES]
            .copy_from_slice(&(2_u16).to_le_bytes());
        let second_type = manifest_start + U16_BYTES + (1 + U64_BYTES + U64_BYTES + SHA256_BYTES);
        tampered[second_type] = AssetType::ConfigJson as u8;

        let err = extract_asset_bundle(&tampered).expect_err("must fail");
        assert!(matches!(
            err,
            OrchestratorError::DuplicateAssetType(AssetType::ConfigJson)
        ));
    }

    #[test]
    fn fails_missing_config() {
        let mut manifest = Vec::new();
        manifest.extend_from_slice(&(1_u16).to_le_bytes());
        manifest.push(AssetType::HeroImage as u8);
        manifest.extend_from_slice(&0_u64.to_le_bytes());
        manifest.extend_from_slice(&4_u64.to_le_bytes());
        manifest.extend_from_slice(&sha256(b"hero"));

        let mut binary = b"ELFhero".to_vec();
        binary.extend_from_slice(&manifest);
        binary.extend_from_slice(TRAILER_MAGIC);
        binary.extend_from_slice(&(manifest.len() as u64).to_le_bytes());

        let err = extract_asset_bundle(&binary).expect_err("must fail");
        assert!(matches!(
            err,
            OrchestratorError::MissingRequiredAsset(AssetType::ConfigJson)
        ));
    }
}
