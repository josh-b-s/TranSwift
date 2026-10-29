import gtfsRouterRust from '@mapapp/gtfs-router-rust';
import type { ServiceAlertInfo } from '@mapapp/gtfs-router-rust';
import { getActiveDatabaseEntry } from '../import/gtfsDbRegistry';
import type { ServiceAlert } from '../alerts/serviceAlert';
import { reportAuthFailure } from './authFailure';
import { fetchWithKey } from './realtimeHttp';

// The stop sheet and the journey card both ask, so one fetch serves both.
const CACHE_MS = 30_000;
let cache: { key: string; at: number; alerts: ServiceAlert[] } | null = null;

const orNull = <T>(value: T | undefined): T | null => value ?? null;

function toServiceAlert(a: ServiceAlertInfo): ServiceAlert {
    return {
        id: a.id,
        header: orNull(a.header),
        description: orNull(a.description),
        periods: a.periods.map(p => ({ startSec: orNull(p.startSec), endSec: orNull(p.endSec) })),
        targets: a.targets.map(t => ({ routeId: orNull(t.routeId), stopId: orNull(t.stopId), tripId: orNull(t.tripId) })),
    };
}

/**
 * Fetches the active feed's ServiceAlerts URLs in parallel and decodes them in the engine. A URL that fails is
 * logged and skipped, so one bad feed does not hide the others' alerts. Empty when no URLs are set.
 */
export async function fetchServiceAlerts(): Promise<ServiceAlert[]> {
    const entry = await getActiveDatabaseEntry();
    const urls = entry?.alertUrls ?? [];
    if (!entry || urls.length === 0) return [];

    const key = `${entry.id}|${urls.join('|')}|${entry.realtimeHeader ?? ''}|${entry.realtimeQuery ?? ''}`;
    if (cache?.key === key && Date.now() - cache.at < CACHE_MS) return cache.alerts;

    const results = await Promise.allSettled(urls.map(url => fetchWithKey(entry, url)));
    reportAuthFailure(entry, results);
    const feeds: ArrayBuffer[] = [];
    results.forEach((result, i) => {
        if (result.status === 'fulfilled') feeds.push(result.value);
        else console.warn(`[serviceAlerts] ${urls[i]} failed:`, result.reason);
    });
    if (feeds.length === 0) return [];

    const alerts = gtfsRouterRust.gtfs_router.decodeServiceAlerts(feeds).map(toServiceAlert);
    cache = { key, at: Date.now(), alerts };
    return alerts;
}
