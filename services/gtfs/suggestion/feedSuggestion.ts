/**
 * feedSuggestion.ts — decides whether to prompt the user about GTFS data for
 * where they are:
 *  - a feed that covers them is already imported and its timetable ends soon: re-download it;
 *  - no imported feed covers them: suggest the largest catalog feed that does.
 * A feed covers them if its bounding box contains them, or, for feeds the catalog has
 * no box for, if it is in their region (reverse geocode). Both kinds compete on zip
 * size, so a state-wide feed beats a small operator inside it. A feed already on the
 * device is never suggested again.
 */

import * as Location from 'expo-location';
import { feedsAround, feedsInRegion, largestFirst, type Region } from '../catalog/catalogFilter';
import type { CatalogFeed } from '../catalog/catalogParse';
import { coverageContains, type Point } from '../catalog/coverage';
import { loadCatalog } from '../catalog/feedCatalog';
import { fetchZipSize } from '../import/gtfsDownload';
import { ensureActiveStats, listDatabases, type GtfsDatabaseEntry } from '../import/gtfsDbRegistry';
import { isCurrentSchema } from '../import/schemaVersion';
import { daysUntilGtfsDate } from './serviceDate';
import { hasNewerVersion } from './feedUpdate';

const EXPIRY_WARNING_DAYS = 14;

async function regionOf(at: Point): Promise<Region | null> {
    const [place] = await Location.reverseGeocodeAsync(at);
    return place?.isoCountryCode && place.region ? { country: place.isoCountryCode, subdivision: place.region } : null;
}

async function zipSize(feed: CatalogFeed): Promise<number | null> {
    try {
        return await fetchZipSize(feed.zipUrl);
    } catch (err) {
        console.warn(`[feedSuggestion] size check failed for "${feed.provider}":`, err);
        return null;
    }
}

/** Catalog feeds covering `at`, by bounding box or by region, largest download first. */
async function catalogFeedsAt(feeds: CatalogFeed[], at: Point): Promise<CatalogFeed[]> {
    // The boxes still work if the geocoder doesn't.
    const region = await regionOf(at).catch((err) => {
        console.warn('[feedSuggestion] reverse geocode failed:', err);
        return null;
    });
    const covering = [...feedsAround(feeds, at), ...(region ? feedsInRegion(feeds, region) : [])];
    if (covering.length < 2) return covering;
    return largestFirst(covering, await Promise.all(covering.map(zipSize)));
}

export type FeedSuggestion =
    | { kind: 'nearby'; feed: CatalogFeed }
    | { kind: 'expiring'; entry: GtfsDatabaseEntry; daysLeft: number }
    | { kind: 'updated'; entry: GtfsDatabaseEntry }
    | { kind: 'oldFormat'; entry: GtfsDatabaseEntry };

function expiryOf(entries: GtfsDatabaseEntry[]): FeedSuggestion | null {
    const latest = entries.reduce((a, b) => ((b.stats!.serviceEnd ?? '') > (a.stats!.serviceEnd ?? '') ? b : a));
    const end = latest.stats!.serviceEnd;
    // Without a source URL there is nothing to re-download.
    if (!end || !latest.source) return null;
    const daysLeft = daysUntilGtfsDate(end);
    return daysLeft <= EXPIRY_WARNING_DAYS ? { kind: 'expiring', entry: latest, daysLeft } : null;
}

/**
 * A database the app can no longer open, a newer upstream version, or realtime ids that stopped matching. Only for
 * entries that can be re-downloaded. Mismatched realtime ids count only when downloading again could help: the server
 * has a newer zip, or it can't be told and the ids matched before, so the timetable changed since. Ids that never
 * matched are the provider's doing and a new download keeps them.
 */
async function updateOf(entries: GtfsDatabaseEntry[]): Promise<FeedSuggestion | null> {
    const downloadable = entries.filter((e) => e.source);
    const oldFormat = downloadable.find((e) => !isCurrentSchema(e));
    if (oldFormat) return { kind: 'oldFormat', entry: oldFormat };

    for (const entry of downloadable) {
        let newer: boolean | null = null;
        try {
            newer = await hasNewerVersion(entry);
        } catch (err) {
            console.warn(`[feedSuggestion] update check failed for "${entry.name}":`, err);
        }
        const staleIds = entry.realtimeMismatch && entry.realtimeMatched && newer === null;
        if (newer || staleIds) return { kind: 'updated', entry };
    }
    return null;
}

async function expiryOrUpdateOf(entries: GtfsDatabaseEntry[]): Promise<FeedSuggestion | null> {
    return expiryOf(entries) ?? (await updateOf(entries));
}

export async function findFeedSuggestion(at: Point): Promise<FeedSuggestion | null> {
    await ensureActiveStats();
    const entries = await listDatabases();

    // Without stats we can't tell what an entry covers, so any suggestion could be wrong.
    if (entries.some((e) => !e.stats)) return null;

    const covering = entries.filter((e) => e.stats!.coverage && coverageContains(e.stats!.coverage, at));
    if (covering.length > 0) return expiryOrUpdateOf(covering);

    const { feeds } = await loadCatalog();
    const candidates = await catalogFeedsAt(feeds, at);
    if (candidates.length === 0) return null;

    // The best feed covers this spot in the catalog but not by its stops, or has no catalog box at all.
    const [best] = candidates;
    const imported = entries.filter((e) => e.source?.id === best.id);
    return imported.length > 0 ? expiryOrUpdateOf(imported) : { kind: 'nearby', feed: best };
}