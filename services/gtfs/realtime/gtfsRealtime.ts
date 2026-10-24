import { getActiveDatabaseEntry, setRealtimeMismatch } from '../import/gtfsDbRegistry';

const MIN_REFRESH_MS = 30_000;
const MAX_STALE_MS = 5 * 60_000;
// A feed with at least this many updates, most matching no trip, means the timetable is out of date.
const MISMATCH_MIN_UPDATES = 20;
const MISMATCH_RATIO = 0.5;

type FeedStats = { tripUpdates: number; unmatched: number; applied: number; sampleUnmatchedTripId?: string };
type Engine = { setRealtime(feeds: ArrayBuffer[]): Promise<FeedStats[]>; clearRealtime(): void };

let lastKey: string | null = null;
let lastRefreshAt = 0;
// Last good bytes per URL, so one failing feed doesn't drop the others' delays.
const lastGood = new Map<string, { bytes: ArrayBuffer; at: number }>();

function parseHeader(header: string): [string, string] | null {
    const i = header.indexOf(':');
    if (i <= 0) return null;
    return [header.slice(0, i).trim(), header.slice(i + 1).trim()];
}

/** ".../v1/metro/trip-updates" -> "metro", for log lines. */
function feedLabel(url: string): string {
    const parts = url.split('?')[0].split('/').filter(Boolean);
    return parts.length >= 2 ? parts[parts.length - 2] : url;
}

async function fetchFeed(url: string, headers: Record<string, string>): Promise<ArrayBuffer> {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.arrayBuffer();
}

/**
 * Fetches the active feed's TripUpdates URLs in parallel and hands the raw
 * bytes to the engine as one merged overlay. No-op without URLs, or when the
 * last refresh for this set is under 30 s old. A URL that fails reuses its
 * last good bytes for up to 5 minutes, then is dropped.
 */
export async function refreshRealtime(engine: Engine): Promise<void> {
    const entry = await getActiveDatabaseEntry();
    const urls = entry?.realtimeUrls ?? [];
    if (!entry || urls.length === 0) {
        if (lastKey !== null) engine.clearRealtime();
        lastKey = null;
        lastGood.clear();
        return;
    }

    const key = `${entry.id}|${urls.join('|')}|${entry.realtimeHeader ?? ''}`;
    if (key !== lastKey) lastGood.clear();
    if (key === lastKey && Date.now() - lastRefreshAt < MIN_REFRESH_MS) return;

    const parsed = entry.realtimeHeader ? parseHeader(entry.realtimeHeader) : null;
    const headers = parsed ? { [parsed[0]]: parsed[1] } : {};

    const results = await Promise.allSettled(urls.map(url => fetchFeed(url, headers)));
    const now = Date.now();
    results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
            lastGood.set(urls[i], { bytes: result.value, at: now });
        } else {
            console.warn(`[gtfsRealtime] ${urls[i]} failed:`, result.reason);
        }
    });

    const used = urls.flatMap(url => {
        const good = lastGood.get(url);
        return good && now - good.at < MAX_STALE_MS ? [{ url, bytes: good.bytes }] : [];
    });
    if (used.length === 0) return;

    try {
        const stats = await engine.setRealtime(used.map(f => f.bytes));
        lastKey = key;
        lastRefreshAt = now;
        const perFeed = used.map((f, i) => {
            const s = stats[i];
            const sample = s.sampleUnmatchedTripId ? `, e.g. unmatched "${s.sampleUnmatchedTripId}"` : '';
            return `${feedLabel(f.url)} ${s.applied} applied of ${s.tripUpdates} updates (${s.unmatched} unmatched${sample})`;
        });
        console.log(`[gtfsRealtime] ${used.length}/${urls.length} feeds\n  ${perFeed.join('\n  ')}`);

        const mismatch = stats.some(s => s.tripUpdates >= MISMATCH_MIN_UPDATES && s.unmatched / s.tripUpdates > MISMATCH_RATIO);
        await setRealtimeMismatch(entry.id, mismatch);
    } catch (err) {
        console.warn('[gtfsRealtime] realtime update failed, keeping last known delays:', err);
    }
}
