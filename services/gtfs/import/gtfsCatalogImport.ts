import * as FileSystem from 'expo-file-system/legacy';
import type { CatalogFeed } from '../catalog/catalogParse';
import { downloadZip } from './gtfsDownload';
import { importZipAsNewDatabase } from './gtfsDbImport';
import {
    deleteDatabase,
    listDatabases,
    renameDatabase,
    setRealtimeAuthHint,
    setRealtimeConfig,
    type GtfsDatabaseEntry,
} from './gtfsDbRegistry';
import { autofillRealtime } from './realtimeAutofill';
import type { ImportProgressEvent } from './rustGtfsImporter';

/**
 * Downloads a catalog feed, imports it as a new database, then deletes the zip.
 * With `replaceId`, the database it replaces is deleted afterwards and the new
 * one takes over its name and realtime settings. Otherwise the realtime URLs
 * are filled in from the Mobility Database.
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
            etag: zip.etag,
            lastModified: zip.lastModified,
        }, signal);

        const old = replaceId ? (await listDatabases()).find((d) => d.id === replaceId) : undefined;
        if (old) {
            await deleteDatabase(old.id);
            await renameDatabase(entry.id, old.name);
        }

        if (old && (old.realtimeUrls || old.vehicleUrls || old.alertUrls)) {
            await setRealtimeConfig(
                entry.id,
                old.realtimeUrls ?? [],
                old.realtimeHeader ?? '',
                old.vehicleUrls ?? [],
                old.alertUrls ?? [],
            );
            if (old.realtimeAuth) await setRealtimeAuthHint(entry.id, old.realtimeAuth);
        } else {
            // The import already succeeded; a catalog lookup problem shouldn't undo it.
            await autofillRealtime(entry).catch((err) => console.warn('[catalogImport] realtime autofill failed:', err));
        }
        return entry;
    } finally {
        await FileSystem.deleteAsync(zip.uri, { idempotent: true });
    }
}
