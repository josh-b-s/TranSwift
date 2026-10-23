import * as FileSystem from 'expo-file-system/legacy';
import type { CatalogFeed } from '../catalog/catalogParse';
import { downloadZip } from './gtfsDownload';
import { importZipAsNewDatabase } from './gtfsDbImport';
import type { GtfsDatabaseEntry } from './gtfsDbRegistry';
import type { ImportProgressEvent } from './rustGtfsImporter';

/** Downloads a catalog feed, imports it as a new database, then deletes the zip. */
export async function importCatalogFeed(
    feed: CatalogFeed,
    onDownload: (written: number, total: number) => void,
    onImport: (p: ImportProgressEvent) => void,
): Promise<GtfsDatabaseEntry> {
    const zip = await downloadZip(feed.zipUrl, `${feed.id}.zip`, onDownload);
    try {
        return await importZipAsNewDatabase(zip, onImport, {
            label: feed.name ? `${feed.provider} (${feed.name})` : feed.provider,
            url: feed.zipUrl,
            license: feed.licenseUrl || undefined,
        });
    } finally {
        await FileSystem.deleteAsync(zip.uri, { idempotent: true });
    }
}
