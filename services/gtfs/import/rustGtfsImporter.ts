/**
 * rustGtfsImporter.ts: bridge to the native Rust import_gtfs() (modules/gtfs-importer/rust).
 * ProgressCallback is a TypeScript interface, so it can't be extended. Pass a plain object literal; ubrn wraps it for the FFI call.
 */

import {cancelImport, importGtfs, type ProgressCallback} from '@mapapp/gtfs-importer';
import {CancelledError} from './cancelledError';

export type ImportProgressEvent = { table: string; inserted: number; total: number };

// expo-file-system returns file:// paths, but the Rust side's std::fs::read wants a bare path.
function stripFileScheme(p: string): string {
    return p.startsWith('file://') ? p.slice('file://'.length) : p;
}

/**
 * Runs the native import from `zipPath` into `dbPath`, a new file the importer creates.
 * onProgress fires per table, and every 200,000 rows for stop_times and shapes.
 */
export async function importGtfsZipToPath(
    zipPath: string,
    dbPath: string,
    onProgress?: (p: ImportProgressEvent) => void,
    signal?: AbortSignal,
): Promise<void> {
    const t0 = Date.now();
    const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

    console.log(`[rustGtfsImporter] starting import of ${zipPath} -> ${dbPath}`);

    // Per-table start times, to log a duration when the next table's progress event arrives or the import completes.
    let currentTable: string | null = null;
    let tableStart = Date.now();
    let lastLoggedPercent = -1;

    const progressCallback: ProgressCallback = {
        onProgress(table: string, inserted: bigint, total: bigint) {
            const insertedNum = Number(inserted);
            const totalNum = Number(total);

            if (table !== currentTable) {
                if (currentTable !== null) {
                    console.log(
                        `[rustGtfsImporter] finished ${currentTable} in ${((Date.now() - tableStart) / 1000).toFixed(1)}s (${elapsed()} total)`,
                    );
                }
                currentTable = table;
                tableStart = Date.now();
                lastLoggedPercent = -1;
                console.log(`[rustGtfsImporter] starting table: ${table} (${elapsed()} total)`);
            }

            // Log every 10% so big tables don't flood the console.
            const percent = totalNum > 0 ? Math.floor((insertedNum / totalNum) * 100) : 0;
            if (percent >= lastLoggedPercent + 10 || insertedNum === totalNum) {
                lastLoggedPercent = percent;
                console.log(
                    `[rustGtfsImporter] ${table}: ${insertedNum}/${totalNum} (${percent}%) — ${elapsed()} total`,
                );
            }

            onProgress?.({table, inserted: insertedNum, total: totalNum});
        },
    };

    // The importer stops at its next progress report, so this isn't instant.
    signal?.addEventListener('abort', cancelImport, {once: true});
    if (signal?.aborted) throw new CancelledError();

    try {
        await importGtfs(
            stripFileScheme(zipPath),
            stripFileScheme(dbPath),
            progressCallback,
        );
        if (currentTable !== null) {
            console.log(
                `[rustGtfsImporter] finished ${currentTable} in ${((Date.now() - tableStart) / 1000).toFixed(1)}s`,
            );
        }
        console.log(`[rustGtfsImporter] import complete in ${elapsed()}`);
    } catch (err) {
        if (signal?.aborted) throw new CancelledError();
        // A plain log of the native error prints only the variant name, and Metro's log forwarding drops odd characters, so spell the fields out as plain ASCII.
        const e = err as { name?: unknown; message?: unknown; inner?: unknown };
        const text = (v: unknown) => String(v).replace(/[^\x20-\x7e]/g, '?').replace(/%/g, 'pct');
        console.error(
            `[rustGtfsImporter] import failed after ${elapsed()}: name=${text(e.name)} message=${text(e.message)} inner=${text(JSON.stringify(e.inner))}`,
        );
        throw err;
    }
}