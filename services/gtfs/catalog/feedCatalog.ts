/**
 * feedCatalog.ts — loads the Mobility Database feed list, keeping a copy on
 * disk so browsing works offline and the CSV is only re-downloaded when it's
 * older than MAX_AGE_MS (or the caller forces it).
 */

import * as FileSystem from 'expo-file-system/legacy';
import { parseCatalog, type CatalogFeed } from './catalogParse';

// One constant on purpose: MobilityData has moved this file before.
const CATALOG_URL = 'https://files.mobilitydatabase.org/feeds_v2.csv';
const CACHE_PATH = `${FileSystem.documentDirectory}gtfs-import/feeds_v2.csv`;
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export type CatalogResult = {
    feeds: CatalogFeed[];
    fetchedAt: number;
    /** True when a refresh was needed but failed, so `feeds` is the older cached copy. */
    stale: boolean;
};

async function cacheInfo(): Promise<{ exists: boolean; fetchedAt: number }> {
    const info = await FileSystem.getInfoAsync(CACHE_PATH);
    return info.exists
        ? { exists: true, fetchedAt: Math.round(info.modificationTime * 1000) }
        : { exists: false, fetchedAt: 0 };
}

async function download(): Promise<void> {
    const tmpPath = `${CACHE_PATH}.tmp`;
    await FileSystem.makeDirectoryAsync(CACHE_PATH.slice(0, CACHE_PATH.lastIndexOf('/') + 1), { intermediates: true });
    const res = await FileSystem.downloadAsync(CATALOG_URL, tmpPath);
    if (res.status !== 200) {
        await FileSystem.deleteAsync(tmpPath, { idempotent: true });
        throw new Error(`Catalog download failed (HTTP ${res.status})`);
    }
    // Moving a finished file keeps a dropped connection from corrupting the cache.
    await FileSystem.deleteAsync(CACHE_PATH, { idempotent: true });
    await FileSystem.moveAsync({ from: tmpPath, to: CACHE_PATH });
}

export async function loadCatalog(force = false): Promise<CatalogResult> {
    let cache = await cacheInfo();
    let stale = false;

    if (force || !cache.exists || Date.now() - cache.fetchedAt > MAX_AGE_MS) {
        try {
            await download();
            cache = await cacheInfo();
        } catch (err) {
            // With no cached copy there is nothing to show, so the error goes to the caller.
            if (!cache.exists) throw err;
            stale = true;
        }
    }

    const text = await FileSystem.readAsStringAsync(CACHE_PATH);
    const feeds = parseCatalog(text);
    if (feeds.length > 0 && feeds.every((f) => !f.box)) {
        console.warn('[feedCatalog] no bounding boxes parsed; check BOX_COLUMNS in catalogParse.ts');
    }
    return { feeds, fetchedAt: cache.fetchedAt, stale };
}
