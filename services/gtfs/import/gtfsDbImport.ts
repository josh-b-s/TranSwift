/**
 * gtfsDbImport.ts: the settings screen's "Add zip" flow. Pick a zip, import it into a new database file,
 * and register it as the active one.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { computeFeedStats } from './gtfsFeedStats';
import { importGtfsZipToPath, type ImportProgressEvent } from './rustGtfsImporter';
import {
    DuplicateFeedError,
    findDatabaseByHash,
    nameFromZipFileName,
    type FeedSource,
    registerDatabase,
    saveFeedStats,
    type GtfsDatabaseEntry,
} from './gtfsDbRegistry';

const SQLITE_DIR = `${FileSystem.documentDirectory}SQLite/`;

/** Opens the system file picker for a zip. Returns null if the user cancelled. */
export async function pickGtfsZip(): Promise<DocumentPicker.DocumentPickerAsset | null> {
    const result = await DocumentPicker.getDocumentAsync({
        // Some Android file providers don't tag zips as application/zip, so this type is only a hint.
        type: ['application/zip', 'application/x-zip-compressed'],
        copyToCacheDirectory: true,
        multiple: false,
    });
    if (result.canceled || result.assets.length === 0) return null;
    return result.assets[0];
}

/**
 * Imports `zip` into a fresh database file and registers it, named after the zip by default.
 * The zip is hashed first. A hash matching an imported feed throws DuplicateFeedError with that entry attached,
 * so the settings screen can offer it instead of a multi-minute re-import.
 */
export async function importZipAsNewDatabase(
    zip: { uri: string; name?: string },
    onProgress?: (p: ImportProgressEvent) => void,
    source?: FeedSource,
    signal?: AbortSignal,
): Promise<GtfsDatabaseEntry> {
    // md5 is computed natively, so the zip (possibly 100+ MB) isn't read into JS memory.
    const { md5 } = await FileSystem.getInfoAsync(zip.uri, { md5: true }) as { md5?: string };
    if (md5) {
        const existing = await findDatabaseByHash(md5);
        if (existing) throw new DuplicateFeedError(existing);
    }

    await FileSystem.makeDirectoryAsync(SQLITE_DIR, { intermediates: true }).catch(() => {});

    const fileName = `gtfs-${Date.now()}.db`;
    const dbPath = `${SQLITE_DIR}${fileName}`;

    try {
        await importGtfsZipToPath(zip.uri, dbPath, onProgress, signal);
    } catch (err) {
        // A failed or aborted import leaves a half-built db (and maybe WAL files) behind.
        await Promise.all(
            ['', '-wal', '-shm', '-journal'].map((ext) =>
                FileSystem.deleteAsync(`${dbPath}${ext}`, { idempotent: true }),
            ),
        );
        throw err;
    }

    const name = source?.label ?? nameFromZipFileName(zip.name ?? 'Imported feed');
    const entry = await registerDatabase(name, fileName, md5, source);
    // registerDatabase made this the active database, which computeFeedStats reads.
    const stats = await computeFeedStats();
    await saveFeedStats(entry.id, stats);
    return { ...entry, stats };
}
