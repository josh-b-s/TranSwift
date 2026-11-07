import * as FileSystem from 'expo-file-system/legacy';
import { listDatabases } from './gtfsDbRegistry';

const SQLITE_DIR = `${FileSystem.documentDirectory}SQLite/`;
const DOWNLOAD_DIR = `${FileSystem.cacheDirectory}gtfs-download/`;
const SIDECARS = ['-wal', '-shm', '-journal'];

/** Deletes a database file along with its WAL, shared-memory and journal files. */
export async function deleteDatabaseFiles(path: string): Promise<void> {
    await Promise.all(['', ...SIDECARS].map((ext) => FileSystem.deleteAsync(`${path}${ext}`, { idempotent: true })));
}

/**
 * Run once at startup. Removes zips left in the cache by an interrupted download or import, and
 * gtfs-*.db files the registry no longer lists (from a crashed import or an old delete).
 */
export async function cleanGtfsStorage(): Promise<void> {
    await FileSystem.deleteAsync(DOWNLOAD_DIR, { idempotent: true });

    const dir = await FileSystem.getInfoAsync(SQLITE_DIR);
    if (!dir.exists) return;
    const kept = new Set((await listDatabases()).map((d) => d.fileName));
    const names = await FileSystem.readDirectoryAsync(SQLITE_DIR);
    const orphans = names.filter((n) => /^gtfs-\d+\.db(-wal|-shm|-journal)?$/.test(n) && !kept.has(n.replace(/-(wal|shm|journal)$/, '')));
    await Promise.all(orphans.map((n) => FileSystem.deleteAsync(`${SQLITE_DIR}${n}`, { idempotent: true })));
}
