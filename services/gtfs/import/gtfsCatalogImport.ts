import * as FileSystem from 'expo-file-system/legacy';
import type { CatalogFeed } from '../catalog/catalogParse';
import { downloadZip } from './gtfsDownload';
import { importZipAsNewDatabase } from './gtfsDbImport';
import { deleteDatabase, listDatabases, renameDatabase, type GtfsDatabaseEntry } from './gtfsDbRegistry';
import type { ImportProgressEvent } from './rustGtfsImporter';

/**
 * Downloads a catalog feed, imports it as a new database, then deletes the zip.
 * With `replaceId`, the database it replaces is deleted afterwards and the new
 * one takes over its name.
 */
export async function importCatalogFeed(
    feed: CatalogFeed,
    onDownload: (written: number, total: number) => void,
    onImport: (p: ImportProgressEvent) => void,
    replaceId?: string,
    signal?: AbortSignal,
): Promise<GtfsDatabaseEntry> {
    const zip = await downloadZip(feed.zipUrl, `${feed.id}.zip`, onDownload, signal);
    try {
        const entry = await importZipAsNewDatabase(zip, onImport, {
            id: feed.id,
            label: feed.name ? `${feed.provider} (${feed.name})` : feed.provider,
            url: feed.zipUrl,
            license: feed.licenseUrl || undefined,
        }, signal);

        const old = replaceId ? (await listDatabases()).find((d) => d.id === replaceId) : undefined;
        if (old) {
            await deleteDatabase(old.id);
            await renameDatabase(entry.id, old.name);
        }
        return entry;
    } finally {
        await FileSystem.deleteAsync(zip.uri, { idempotent: true });
    }
}
