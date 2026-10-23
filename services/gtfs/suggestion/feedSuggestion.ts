/**
 * feedSuggestion.ts — decides whether to prompt the user about GTFS data for
 * where they are:
 *  - inside an imported feed's coverage, and its timetable ends soon: re-download it;
 *  - outside every imported feed: suggest the best catalog feed that covers them,
 *    by bounding box first, then by region for feeds the catalog has no box for.
 */

import * as Location from 'expo-location';
import { feedsAround, feedsInRegion, type Region } from '../catalog/catalogFilter';
import type { CatalogFeed } from '../catalog/catalogParse';
import { coverageContains, type Point } from '../catalog/coverage';
import { loadCatalog } from '../catalog/feedCatalog';
import { ensureActiveStats, listDatabases, type GtfsDatabaseEntry } from '../import/gtfsDbRegistry';
import { daysUntilGtfsDate } from './serviceDate';

const EXPIRY_WARNING_DAYS = 14;

async function regionOf(at: Point): Promise<Region | null> {
    const [place] = await Location.reverseGeocodeAsync(at);
    return place?.isoCountryCode && place.region ? { country: place.isoCountryCode, subdivision: place.region } : null;
}

async function bestCatalogFeed(feeds: CatalogFeed[], at: Point): Promise<CatalogFeed | undefined> {
    const [byBox] = feedsAround(feeds, at);
    if (byBox) return byBox;
    const region = await regionOf(at);
    return region ? feedsInRegion(feeds, region)[0] : undefined;
}

export type FeedSuggestion =
    | { kind: 'nearby'; feed: CatalogFeed }
    | { kind: 'expiring'; entry: GtfsDatabaseEntry; daysLeft: number };

export async function findFeedSuggestion(at: Point): Promise<FeedSuggestion | null> {
    await ensureActiveStats();
    const entries = await listDatabases();

    // Without stats we can't tell what an entry covers, so any suggestion could be wrong.
    if (entries.some((e) => !e.stats)) return null;

    const covering = entries.filter((e) => e.stats!.coverage && coverageContains(e.stats!.coverage, at));
    if (covering.length > 0) {
        const latest = covering.reduce((a, b) => ((b.stats!.serviceEnd ?? '') > (a.stats!.serviceEnd ?? '') ? b : a));
        const end = latest.stats!.serviceEnd;
        // Without a source URL there is nothing to re-download.
        if (!end || !latest.source) return null;
        const daysLeft = daysUntilGtfsDate(end);
        return daysLeft <= EXPIRY_WARNING_DAYS ? { kind: 'expiring', entry: latest, daysLeft } : null;
    }

    const { feeds } = await loadCatalog();
    const best = await bestCatalogFeed(feeds, at);
    return best ? { kind: 'nearby', feed: best } : null;
}
