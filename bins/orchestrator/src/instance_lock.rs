use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use anyhow::{anyhow, Context};
use orchestrator_core::prefix::compact_exe_hash_key;

#[derive(Debug)]
pub struct InstanceLockGuard {
    lock_path: PathBuf,
    _file: File,
}

impl InstanceLockGuard {
    pub fn lock_path(&self) -> &Path {
        &self.lock_path
    }
}

impl Drop for InstanceLockGuard {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.lock_path);
    }
}

pub fn acquire_instance_lock(exe_hash: &str) -> anyhow::Result<InstanceLockGuard> {
    let lock_dir = default_lock_dir()?;
    acquire_instance_lock_in_dir(exe_hash, &lock_dir)
}

fn acquire_instance_lock_in_dir(
    exe_hash: &str,
    lock_dir: &Path,
) -> anyhow::Result<InstanceLockGuard> {
    fs::create_dir_all(lock_dir)
        .with_context(|| format!("failed to create lock directory {}", lock_dir.display()))?;

    let lock_path = resolve_lock_path(lock_dir, exe_hash)?;

    match create_lock_file(&lock_path) {
        Ok(file) => Ok(InstanceLockGuard {
            lock_path,
            _file: file,
        }),
        Err(err) => {
            if err.kind() != std::io::ErrorKind::AlreadyExists {
                return Err(err).with_context(|| {
                    format!("failed to create lock file {}", lock_path.display())
                });
            }

            if try_reclaim_stale_lock(&lock_path)? {
                let file = create_lock_file(&lock_path).with_context(|| {
                    format!(
                        "failed to create lock file after stale cleanup {}",
                        lock_path.display()
                    )
                })?;

                return Ok(InstanceLockGuard {
                    lock_path,
                    _file: file,
                });
            }

            Err(anyhow!(
                "another instance for this game is already running (lock={})",
                lock_path.display()
            ))
        }
    }
}

fn default_lock_dir() -> anyhow::Result<PathBuf> {
    let home = std::env::var_os("HOME").ok_or_else(|| anyhow!("HOME is not set"))?;
    Ok(PathBuf::from(home).join(".local/share/GameOrchestrator/locks"))
}

fn sanitize_lock_key(raw: &str) -> anyhow::Result<String> {
    let key = raw
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .collect::<String>();

    if key.is_empty() {
        return Err(anyhow!("exe_hash is empty after sanitization"));
    }

    Ok(key)
}

fn resolve_lock_path(lock_dir: &Path, exe_hash: &str) -> anyhow::Result<PathBuf> {
    let short_key = sanitize_lock_key(&compact_exe_hash_key(exe_hash))?;
    let short_path = lock_dir.join(format!("{short_key}.lock"));

    let legacy_key = sanitize_lock_key(exe_hash)?;
    let legacy_path = lock_dir.join(format!("{legacy_key}.lock"));

    // Backward compatibility: if an older full-hash lock exists, keep using it.
    if legacy_path.exists() && !short_path.exists() {
        return Ok(legacy_path);
    }

    Ok(short_path)
}

fn create_lock_file(lock_path: &Path) -> std::io::Result<File> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(lock_path)?;
    write_lock_metadata(&mut file)?;
    Ok(file)
}

fn write_lock_metadata(file: &mut File) -> std::io::Result<()> {
    let pid = std::process::id();
    let created_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    writeln!(file, "pid={pid}")?;
    writeln!(file, "created_at={created_at}")?;
    file.sync_all()
}

fn try_reclaim_stale_lock(lock_path: &Path) -> anyhow::Result<bool> {
    let Some(pid) = read_lock_pid(lock_path)? else {
        return Ok(false);
    };

    if is_pid_running(pid) {
        return Ok(false);
    }

    fs::remove_file(lock_path)
        .with_context(|| format!("failed to remove stale lock {}", lock_path.display()))?;
    Ok(true)
}

fn read_lock_pid(lock_path: &Path) -> anyhow::Result<Option<u32>> {
    let mut raw = String::new();
    File::open(lock_path)
        .with_context(|| format!("failed to open lock file {}", lock_path.display()))?
        .read_to_string(&mut raw)
        .with_context(|| format!("failed to read lock file {}", lock_path.display()))?;

    for line in raw.lines() {
        if let Some(value) = line.strip_prefix("pid=") {
            if let Ok(pid) = value.trim().parse::<u32>() {
                return Ok(Some(pid));
            }
        }
    }

    Ok(None)
}

fn is_pid_running(pid: u32) -> bool {
    Path::new("/proc").join(pid.to_string()).exists()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_dir(label: &str) -> PathBuf {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time should be monotonic")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "orchestrator-lock-test-{label}-{}-{ts}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).expect("create test dir");
        dir
    }

    #[test]
    fn denies_second_lock_while_first_is_held() {
        let dir = create_test_dir("exclusive");

        let first = acquire_instance_lock_in_dir("abc123", &dir).expect("first lock");
        let second =
            acquire_instance_lock_in_dir("abc123", &dir).expect_err("second lock must fail");

        assert!(second.to_string().contains("already running"));

        drop(first);
        acquire_instance_lock_in_dir("abc123", &dir).expect("lock should be reacquirable");

        fs::remove_dir_all(&dir).expect("cleanup test dir");
    }

    #[test]
    fn reclaims_stale_lock_with_dead_pid() {
        let dir = create_test_dir("stale");
        let lock_path = dir.join("abc123.lock");
        fs::write(&lock_path, "pid=4294967295\ncreated_at=0\n").expect("write stale lock");

        let guard = acquire_instance_lock_in_dir("abc123", &dir).expect("lock should be reclaimed");
        assert_eq!(guard.lock_path(), lock_path.as_path());

        drop(guard);
        fs::remove_dir_all(&dir).expect("cleanup test dir");
    }

    #[test]
    fn prefers_legacy_full_hash_lock_when_it_already_exists() {
        let dir = create_test_dir("legacy-path");
        let full_hash = "d21d0173c3028c190055ae1f14f9a4c282e8e58318975fc5d4cefdeb61a15df9";
        let legacy_path = dir.join(format!("{full_hash}.lock"));
        fs::write(&legacy_path, "pid=4294967295\ncreated_at=0\n").expect("write stale lock");

        let guard =
            acquire_instance_lock_in_dir(full_hash, &dir).expect("lock should reuse legacy path");
        assert_eq!(guard.lock_path(), legacy_path.as_path());

        drop(guard);
        fs::remove_dir_all(&dir).expect("cleanup test dir");
    }
}
