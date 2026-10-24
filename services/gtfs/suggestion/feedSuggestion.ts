/**
 * feedSuggestion.ts — decides whether to prompt the user about GTFS data for
 * where they are:
 *  - a feed that covers them is already imported and its timetable ends soon: re-download it;
 *  - no imported feed covers them: suggest the best catalog feed that does.
 * Coverage is checked by bounding box first, then by region (reverse geocode) for
 * feeds the catalog has no box for. The same checks run against imported feeds, so
 * a feed already on the device is never suggested again.
 */

import * as Location from 'expo-location';
import { feedsAround, feedsInRegion, type Region } from '../catalog/catalogFilter';
import type { CatalogFeed } from '../catalog/catalogParse';
import { coverageContains, type Point } from '../catalog/coverage';
import { loadCatalog } from '../catalog/feedCatalog';
import { ensureActiveStats, listDatabases, type GtfsDatabaseEntry } from '../import/gtfsDbRegistry';
import { daysUntilGtfsDate } from './serviceDate';
import { hasNewerVersion } from './feedUpdate';

const EXPIRY_WARNING_DAYS = 14;

async function regionOf(at: Point): Promise<Region | null> {
    const [place] = await Location.reverseGeocodeAsync(at);
    return place?.isoCountryCode && place.region ? { country: place.isoCountryCode, subdivision: place.region } : null;
}

/** Catalog feeds covering `at`: by bounding box, or failing that by region. */
async function catalogFeedsAt(feeds: CatalogFeed[], at: Point): Promise<CatalogFeed[]> {
    const byBox = feedsAround(feeds, at);
    if (byBox.length > 0) return byBox;
    const region = await regionOf(at);
    return region ? feedsInRegion(feeds, region) : [];
}

export type FeedSuggestion =
    | { kind: 'nearby'; feed: CatalogFeed }
    | { kind: 'expiring'; entry: GtfsDatabaseEntry; daysLeft: number }
    | { kind: 'updated'; entry: GtfsDatabaseEntry };

function expiryOf(entries: GtfsDatabaseEntry[]): FeedSuggestion | null {
    const latest = entries.reduce((a, b) => ((b.stats!.serviceEnd ?? '') > (a.stats!.serviceEnd ?? '') ? b : a));
    const end = latest.stats!.serviceEnd;
    // Without a source URL there is nothing to re-download.
    if (!end || !latest.source) return null;
    const daysLeft = daysUntilGtfsDate(end);
    return daysLeft <= EXPIRY_WARNING_DAYS ? { kind: 'expiring', entry: latest, daysLeft } : null;
}

/** A newer upstream version, or realtime ids that stopped matching. Only for entries that can be re-downloaded. */
async function updateOf(entries: GtfsDatabaseEntry[]): Promise<FeedSuggestion | null> {
    const downloadable = entries.filter((e) => e.source);
    const mismatched = downloadable.find((e) => e.realtimeMismatch);
    if (mismatched) return { kind: 'updated', entry: mismatched };

    for (const entry of downloadable) {
        try {
            if (await hasNewerVersion(entry)) return { kind: 'updated', entry };
        } catch (err) {
            console.warn(`[feedSuggestion] update check failed for "${entry.name}":`, err);
        }
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

    // Covers this spot in the catalog but not by its stops, or has no catalog box at all.
    const candidateIds = new Set(candidates.map((f) => f.id));
    const imported = entries.filter((e) => e.source && candidateIds.has(e.source.id));
    return imported.length > 0 ? expiryOrUpdateOf(imported) : { kind: 'nearby', feed: candidates[0] };
}