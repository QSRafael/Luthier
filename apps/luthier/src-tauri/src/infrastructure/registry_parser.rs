use luthier_orchestrator_core::RegistryKey;

use crate::application::ports::{RegistryParseOutput, RegistryParserPort};
use crate::error::{BackendError, BackendResult};

#[derive(Debug, Clone, Copy, Default)]
pub struct RegFileRegistryParser;

impl RegFileRegistryParser {
    pub fn new() -> Self {
        Self
    }
}

impl RegistryParserPort for RegFileRegistryParser {
    fn decode_text(&self, bytes: &[u8]) -> BackendResult<String> {
        decode_reg_file_text(bytes).map_err(BackendError::from)
    }

    fn parse_entries(&self, raw: &str) -> RegistryParseOutput {
        let (entries, warnings) = parse_reg_file_entries(raw);
        RegistryParseOutput { entries, warnings }
    }
}

pub(crate) fn decode_reg_file_text(bytes: &[u8]) -> Result<String, String> {
    if bytes.starts_with(&[0xFF, 0xFE]) {
        let mut units = Vec::new();
        let mut iter = bytes[2..].chunks_exact(2);
        for chunk in &mut iter {
            units.push(u16::from_le_bytes([chunk[0], chunk[1]]));
        }
        return String::from_utf16(&units)
            .map_err(|err| format!("invalid UTF-16LE .reg file: {err}"));
    }

    if bytes.starts_with(&[0xFE, 0xFF]) {
        return Err("UTF-16BE .reg files are not supported".to_string());
    }

    let text =
        String::from_utf8(bytes.to_vec()).map_err(|err| format!("invalid UTF-8 .reg file: {err}"))?;
    Ok(text.strip_prefix('\u{feff}').unwrap_or(&text).to_string())
}

pub(crate) fn parse_reg_file_entries(raw: &str) -> (Vec<RegistryKey>, Vec<String>) {
    let mut entries = Vec::new();
    let mut warnings = Vec::new();
    let mut current_path: Option<String> = None;

    for line in fold_reg_continuations(raw).lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with(';') || trimmed.starts_with('#') {
            continue;
        }

        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            current_path = Some(trimmed[1..trimmed.len() - 1].trim().to_string());
            continue;
        }

        if trimmed.eq_ignore_ascii_case("windows registry editor version 5.00")
            || trimmed.eq_ignore_ascii_case("regedit4")
        {
            continue;
        }

        let Some(path) = current_path.clone() else {
            warnings.push(format!("ignored line outside registry key section: {trimmed}"));
            continue;
        };

        let Some((name_raw, value_raw)) = trimmed.split_once('=') else {
            warnings.push(format!("ignored unparsable registry line: {trimmed}"));
            continue;
        };

        let name = match parse_reg_value_name(name_raw.trim()) {
            Some(name) => name,
            None => {
                warnings.push(format!(
                    "ignored registry value with unsupported name syntax: {trimmed}"
                ));
                continue;
            }
        };

        let value_token = value_raw.trim();
        if value_token == "-" {
            warnings.push(format!(
                "ignored deletion entry (unsupported in key list model): {}={}",
                name_raw.trim(),
                value_token
            ));
            continue;
        }

        let (value_type, value, value_warnings) = parse_reg_data(value_token);
        for warning in value_warnings {
            warnings.push(format!("{path} | {name}: {warning}"));
        }
        entries.push(RegistryKey {
            path,
            name,
            value_type,
            value,
        });
    }

    (entries, warnings)
}

fn fold_reg_continuations(raw: &str) -> String {
    let normalized = raw.replace("\r\n", "\n").replace('\r', "\n");
    let mut out = Vec::new();
    let mut acc = String::new();

    for line in normalized.lines() {
        let trimmed_end = line.trim_end();
        if acc.is_empty() {
            acc.push_str(trimmed_end);
        } else {
            acc.push_str(trimmed_end.trim_start());
        }

        if acc.ends_with('\\') {
            acc.pop();
            continue;
        }

        out.push(std::mem::take(&mut acc));
    }

    if !acc.is_empty() {
        out.push(acc);
    }

    out.join("\n")
}

fn parse_reg_value_name(raw: &str) -> Option<String> {
    if raw == "@" {
        return Some("@".to_string());
    }
    if raw.starts_with('"') && raw.ends_with('"') && raw.len() >= 2 {
        return Some(unescape_reg_string(&raw[1..raw.len() - 1]));
    }
    None
}

fn parse_reg_data(raw: &str) -> (String, String, Vec<String>) {
    let lower = raw.to_ascii_lowercase();
    let mut warnings = Vec::new();

    if raw.starts_with('"') && raw.ends_with('"') && raw.len() >= 2 {
        return (
            "REG_SZ".to_string(),
            unescape_reg_string(&raw[1..raw.len() - 1]),
            warnings,
        );
    }

    if let Some(value) = strip_prefix_ascii_case(raw, "dword:") {
        return (
            "REG_DWORD".to_string(),
            value.trim().to_ascii_lowercase(),
            warnings,
        );
    }

    if lower.starts_with("hex(b):") {
        let payload = &raw[7..];
        let value = match normalize_registry_hex_payload(payload) {
            Ok(value) => value,
            Err(err) => {
                warnings.push(format!("kept raw REG_QWORD hex payload ({err})"));
                payload.trim().to_string()
            }
        };
        return ("REG_QWORD".to_string(), value, warnings);
    }

    if lower.starts_with("hex(2):") {
        let payload = &raw[7..];
        let value = match normalize_registry_hex_payload(payload) {
            Ok(value) => value,
            Err(err) => {
                warnings.push(format!("kept raw REG_EXPAND_SZ hex payload ({err})"));
                payload.trim().to_string()
            }
        };
        return ("REG_EXPAND_SZ".to_string(), value, warnings);
    }

    if lower.starts_with("hex(7):") {
        let payload = &raw[7..];
        let value = match normalize_registry_hex_payload(payload) {
            Ok(value) => value,
            Err(err) => {
                warnings.push(format!("kept raw REG_MULTI_SZ hex payload ({err})"));
                payload.trim().to_string()
            }
        };
        return ("REG_MULTI_SZ".to_string(), value, warnings);
    }

    if lower.starts_with("hex:") {
        let original = &raw[4..];
        let value = match normalize_registry_hex_payload(original) {
            Ok(value) => value,
            Err(err) => {
                warnings.push(format!("kept raw REG_BINARY hex payload ({err})"));
                original.trim().to_string()
            }
        };
        return ("REG_BINARY".to_string(), value, warnings);
    }

    if lower.starts_with("hex(") {
        let type_end = raw.find("):").unwrap_or(raw.len());
        let suffix = if type_end + 2 <= raw.len() {
            &raw[type_end + 2..]
        } else {
            ""
        };
        let value = match normalize_registry_hex_payload(suffix) {
            Ok(value) => value,
            Err(err) => {
                warnings.push(format!("kept raw typed hex payload ({err})"));
                suffix.trim().to_string()
            }
        };
        return ("REG_BINARY".to_string(), value, warnings);
    }

    ("REG_SZ".to_string(), raw.trim().to_string(), warnings)
}

fn strip_prefix_ascii_case<'a>(raw: &'a str, prefix: &str) -> Option<&'a str> {
    if raw.len() < prefix.len() {
        return None;
    }
    let (head, tail) = raw.split_at(prefix.len());
    if head.eq_ignore_ascii_case(prefix) {
        Some(tail)
    } else {
        None
    }
}

fn normalize_registry_hex_payload(raw: &str) -> Result<String, String> {
    let mut chunks = Vec::new();
    for token in raw.split(',') {
        let cleaned = token
            .chars()
            .filter(|ch| !ch.is_whitespace())
            .collect::<String>();

        if cleaned.is_empty() {
            continue;
        }

        if cleaned.len() != 2 || !cleaned.chars().all(|ch| ch.is_ascii_hexdigit()) {
            return Err(format!("invalid hex byte token '{cleaned}'"));
        }

        chunks.push(cleaned.to_ascii_lowercase());
    }

    Ok(chunks.join(","))
}

fn unescape_reg_string(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut chars = raw.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            if let Some(next) = chars.next() {
                out.push(match next {
                    '\\' => '\\',
                    '"' => '"',
                    'n' => '\n',
                    'r' => '\r',
                    't' => '\t',
                    other => other,
                });
            } else {
                out.push('\\');
            }
        } else {
            out.push(ch);
        }
    }
    out
}

