mod source;
mod csv_util;
mod schema;
mod import;
mod background;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use crate::import::{cancelled_error, is_cancelled, ImportProgress};

#[derive(Debug, thiserror::Error, uniffi::Error)]
pub enum ImportError {
    #[error("io error: {0}")]
    Io(String),
    #[error("zip error: {0}")]
    Zip(String),
    #[error("db error: {0}")]
    Db(String),
    #[error("import cancelled")]
    Cancelled,
}

// One import runs at a time, so a single flag is enough.
static CANCEL_REQUESTED: AtomicBool = AtomicBool::new(false);

/// Asks the running import to stop at its next progress report.
#[uniffi::export]
pub fn cancel_import() {
    CANCEL_REQUESTED.store(true, Ordering::SeqCst);
}

#[uniffi::export(with_foreign)]
pub trait ProgressCallback: Send + Sync {
    fn on_progress(&self, table: String, inserted: u64, total: u64);
}

// Bridges the uniffi-facing callback to import.rs's plain trait, so
// import.rs doesn't need to know about uniffi at all.
struct ProgressAdapter(Arc<dyn ProgressCallback>);
impl ImportProgress for ProgressAdapter {
    fn on_progress(&self, table: String, inserted: u64, total: u64) -> rusqlite::Result<()> {
        if CANCEL_REQUESTED.load(Ordering::SeqCst) {
            return Err(cancelled_error());
        }
        self.0.on_progress(table, inserted, total);
        Ok(())
    }
}

// Async so the import runs off the JS thread; otherwise the UI can't redraw
// (progress bar included) until the whole import returns.
#[uniffi::export]
pub async fn import_gtfs(
    zip_path: String,
    db_path: String,
    progress: Arc<dyn ProgressCallback>,
) -> Result<(), ImportError> {
    CANCEL_REQUESTED.store(false, Ordering::SeqCst);
    background::run_on_thread(move || {
        let adapter = ProgressAdapter(progress);
        // A panic would leave the future pending forever, so turn it into an error.
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            import::import_gtfs(&zip_path, &db_path, &adapter)
                .map_err(|e| {
                    if is_cancelled(&e) { ImportError::Cancelled } else { ImportError::Db(e.to_string()) }
                })
        }))
        .unwrap_or_else(|_| Err(ImportError::Db("import panicked".to_string())))
    })
    .await
}

uniffi::setup_scaffolding!();
