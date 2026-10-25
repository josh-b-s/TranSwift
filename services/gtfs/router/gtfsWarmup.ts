import {isDbReady, getCurrentDbPath} from '../../db/sqliteDb';
import {getNativeEngine} from './gtfsRouterNative';

let warmedUp = false;

/**
 * Warms the Rust router engine at app launch so the first search isn't a cold one.
 * Fire and forget from the root layout; a search that starts mid-warm-up joins the same warm-up.
 * Nothing origin-specific is prefetched, since that can't be guessed before the user picks a trip.
 */
export async function warmUpGtfsEngine(): Promise<void> {
    if (warmedUp) return;
    warmedUp = true;

    const t0 = Date.now();

    if (!(await isDbReady())) {
        console.log('[gtfsWarmup] DB not ready yet, skipping warmup');
        warmedUp = false; // retry once a database exists
        return;
    }

    try {
        // Opens the engine's own connection to the same file, and records the path so the first search skips warm-up.
        const nativeEngine = await getNativeEngine(getCurrentDbPath());
        console.log(`[gtfsWarmup] native engine warmed: ${Date.now() - t0}ms total`);
        try {
            // Starts a background read of the stop_times pages a search departing about now needs.
            const now = new Date();
            nativeEngine.prewarmTimetable(now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds());
        } catch (prewarmErr) {
            console.warn('[gtfsWarmup] timetable prewarm failed (non-fatal):', prewarmErr);
        }
    } catch (err) {
        console.warn('[gtfsWarmup] native engine warmup failed (non-fatal):', err);
    }
}
