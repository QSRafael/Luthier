use std::io::{Cursor, Read, Seek, SeekFrom};

use pelite::pe32::Pe as _;
use pelite::pe64::Pe as _;
use pelite::{pe32, pe64};

use crate::application::ports::PeIconReaderPort;
use crate::error::{BackendError, BackendResult};

#[derive(Debug, Clone, Copy, Default)]
pub struct PelitePeIconReader;

impl PelitePeIconReader {
    pub fn new() -> Self {
        Self
    }
}

impl PeIconReaderPort for PelitePeIconReader {
    fn read_ico_icon_groups(&self, executable_bytes: &[u8]) -> BackendResult<Vec<Vec<u8>>> {
        read_all_pe_icon_groups(executable_bytes).map_err(BackendError::from)
    }
}

trait PeResourcesProvider {
    fn get_resources(&self) -> Result<pelite::resources::Resources<'_>, pelite::Error>;
}

impl PeResourcesProvider for pe32::PeFile<'_> {
    fn get_resources(&self) -> Result<pelite::resources::Resources<'_>, pelite::Error> {
        self.resources()
    }
}

impl PeResourcesProvider for pe64::PeFile<'_> {
    fn get_resources(&self) -> Result<pelite::resources::Resources<'_>, pelite::Error> {
        self.resources()
    }
}

pub(crate) fn read_all_pe_icon_groups(exe_bytes: &[u8]) -> Result<Vec<Vec<u8>>, String> {
    with_pe_resources(exe_bytes, |pe| {
        let resources = pe
            .get_resources()
            .map_err(|err| format!("no PE resources found: {err}"))?;

        let mut out = Vec::<Vec<u8>>::new();
        for entry in resources.icons().flatten() {
            let (_name, group) = entry;
            let mut bytes = Vec::new();
            if group.write(&mut bytes).is_ok() && !bytes.is_empty() {
                out.push(bytes);
            }
        }
        Ok(out)
    })
}

fn with_pe_resources<T, F>(exe_bytes: &[u8], f: F) -> Result<T, String>
where
    F: FnOnce(&dyn PeResourcesProvider) -> Result<T, String>,
{
    if pe_is_64(exe_bytes)? {
        let pe = pe64::PeFile::from_bytes(exe_bytes)
            .map_err(|err| format!("failed to parse PE64 executable: {err}"))?;
        f(&pe)
    } else {
        let pe = pe32::PeFile::from_bytes(exe_bytes)
            .map_err(|err| format!("failed to parse PE32 executable: {err}"))?;
        f(&pe)
    }
}

fn pe_is_64(bin: &[u8]) -> Result<bool, String> {
    let mut file = Cursor::new(bin);

    file.seek(SeekFrom::Start(0x3C))
        .map_err(|err| format!("failed to seek DOS header: {err}"))?;
    let mut e_lfanew_bytes = [0u8; 4];
    file.read_exact(&mut e_lfanew_bytes)
        .map_err(|err| format!("failed to read e_lfanew: {err}"))?;
    let e_lfanew = u32::from_le_bytes(e_lfanew_bytes);

    file.seek(SeekFrom::Start(u64::from(e_lfanew)))
        .map_err(|err| format!("failed to seek PE header: {err}"))?;
    let mut signature = [0u8; 4];
    file.read_exact(&mut signature)
        .map_err(|err| format!("failed to read PE signature: {err}"))?;
    if &signature != b"PE\0\0" {
        return Err("invalid PE signature".to_string());
    }

    file.seek(SeekFrom::Current(20))
        .map_err(|err| format!("failed to seek optional header: {err}"))?;
    let mut magic = [0u8; 2];
    file.read_exact(&mut magic)
        .map_err(|err| format!("failed to read optional header magic: {err}"))?;
    let magic = u16::from_le_bytes(magic);

    match magic {
        0x10b => Ok(false),
        0x20b => Ok(true),
        _ => Err(format!("unknown PE optional header magic: {magic:#x}")),
    }
}
