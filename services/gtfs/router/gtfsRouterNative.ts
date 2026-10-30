// Thin adapter over the Rust GtfsRouterEngine that returns the app's GtfsRouteResult shape.

import gtfsRouterRust from '@mapapp/gtfs-router-rust';
import type {
    LatLng,
    RouteResult,
    Journey,
    Leg,
    RouterError,
} from '@mapapp/gtfs-router-rust';
import type {
    GtfsRouteResult,
    GtfsJourney,
    RouteSegment,
} from './routeTypes';
import { createDebugSinkCollector } from '../debug/debugSinkCollector';
import { formatTimings } from './formatTimings';
import { getCurrentDbPath } from '@/services/db/sqliteDb';
import { refreshRealtime } from '../realtime/gtfsRealtime';
import { DEFAULT_MAX_WALK_DISTANCE_M } from '@/constants/walkLimit';

const { GtfsRouterEngine } = gtfsRouterRust.gtfs_router;

// ── Singleton engine, mirrors how you already hold a single sqlite handle open ──
let engine: InstanceType<typeof GtfsRouterEngine> | null = null;
let warmedUpPath: string | null = null;

// warmUp and computeRoute run on a Rust worker thread, so the UI stays responsive during the 12-14s cold warm-up.
// warmUpPromise joins concurrent callers (launch warm-up and an early first search) onto one warm-up.
let warmUpPromise: Promise<void> | null = null;

async function getEngine(dbPath: string): Promise<InstanceType<typeof GtfsRouterEngine>> {
    if (!engine) engine = new GtfsRouterEngine();
    const eng = engine;
    if (warmedUpPath !== dbPath) {
        if (!warmUpPromise) {
            // rebuilds/loads coarse graph + reusable state, ~12-14s cold
            warmUpPromise = eng.warmUp(dbPath)
                .then(() => { warmedUpPath = dbPath; })
                .finally(() => { warmUpPromise = null; });
        }
        await warmUpPromise;
    }
    return eng;
}

/** Exposes the engine singleton so gtfsWarmup.ts can warm it at launch; the first search then skips its own warm_up(). */
export async function getNativeEngine(dbPath?: string | null) {
    if (dbPath) return getEngine(dbPath);
    if (!engine) engine = new GtfsRouterEngine();
    return engine;
}

/**
 * The engine once it has finished warming up for the current database, otherwise null. Callers that only want
 * to read it, such as the departures sheet, use this so they never start the 12 s warm-up themselves.
 */
export function getWarmNativeEngine() {
    return engine && warmedUpPath !== null && warmedUpPath === getCurrentDbPath() ? engine : null;
}

/**
 * Like getWarmNativeEngine, but when a warm-up is already running it waits for that to finish. Never starts one,
 * so a caller that only reads the engine still does not pay for a warm-up nobody asked for.
 */
export async function whenEngineWarm() {
    const warm = getWarmNativeEngine();
    if (warm || !warmUpPromise) return warm;
    await warmUpPromise.catch(() => undefined);
    return getWarmNativeEngine();
}

// Call this once after any GTFS re-import (mirrors your old invalidate flow)
export function invalidateNativeRouter() {
    engine?.invalidate();
    warmedUpPath = null;
    warmUpPromise = null;
}

function secToTimeString(sec?: number): string | undefined {
    if (sec === undefined) return undefined;
    const h = Math.floor(sec / 3600) % 24;
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * loader.rs wants GTFS-style YYYYMMDD in local time. toISOString() is hyphenated and UTC, so it gives the wrong
 * day for early-morning searches in Melbourne.
 */
function toGtfsDateString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
}

function toSegment(seg: import('@mapapp/gtfs-router-rust').RouteSegment): RouteSegment {
    // segments live on Journey.segments, not under Leg (see lib.rs).
    return {
        coords: seg.coords,
        routeName: seg.routeName,
        routeType: seg.routeType,
        routeColor: seg.routeColor,
        routeTextColor: seg.routeTextColor,
        originStopName: seg.originStopName,
        destStopName: seg.destStopName,
        type: seg.isWalk ? 'walk' : 'transit',
        departureTime: secToTimeString(seg.departureTimeSec),
        arrivalTime: secToTimeString(seg.arrivalTimeSec),
        stops: seg.stops,
        tripPk: seg.tripPk ?? undefined,
        alightSequence: seg.alightSequence ?? undefined,
    };
}

function toJourney(j: Journey): GtfsJourney {
    // j.segments are the fine walk/transit polyline pieces; j.legs are the coarser board-here, alight-there summary.
    const segments = j.segments.map(toSegment);
    const first = j.legs[0];
    const last = j.legs[j.legs.length - 1];
    return {
        coords: j.coords,
        segments,
        legs: j.legs.map((leg: Leg) => ({
            routeName: leg.routeName,
            routeType: leg.routeType,
            routeColor: leg.routeColor,
            routeTextColor: leg.routeTextColor,
            originStopName: leg.originStopName,
            destStopName: leg.destStopName,
            departureTime: secToTimeString(leg.departureTimeSec),
            arrivalTime: secToTimeString(leg.arrivalTimeSec),
            departureDelaySec: leg.departureDelaySec,
        })),
        routeName: j.routeName,
        routeType: j.routeType,
        routeColor: j.routeColor,
        routeTextColor: j.routeTextColor,
        originStopName: j.originStopName,
        destStopName: j.destStopName,
        transferStopName: j.transferStopName,
        totalDurationMin: j.totalDurationMin,
        totalWalkingMeters: j.totalWalkingMeters,
        transferCount: j.transferCount,
        departureTime: secToTimeString(j.departureTimeSec)!,
        arrivalTime: secToTimeString(j.arrivalTimeSec)!,
    };
}

/** One line per journey for the console, so settings can be compared on the result as well as the timings. */
function summarizeJourneys(journeys: Journey[]): string {
    if (journeys.length === 0) return '[gtfsRouterNative] journeys: none';
    const lines = journeys.map((j, i) => {
        const legs = j.legs.map((l: Leg) => l.routeName).join(' → ');
        return (
            `  #${i + 1} ${secToTimeString(j.departureTimeSec)}→${secToTimeString(j.arrivalTimeSec)} · ` +
            `${Number(j.totalDurationMin)}min · ${Number(j.transferCount)} transfer(s) · ` +
            `${Number(j.totalWalkingMeters)}m walk · ${legs}`
        );
    });
    return `[gtfsRouterNative] journeys (${journeys.length})` + '\n' + lines.join('\n');
}

/**
 * Runs a search on the Rust RAPTOR engine. The database path is read on every call, so switching databases in settings
 * takes effect on the next search.
 */
export async function computeGtfsRouteNative(
    origin: LatLng,
    destination: LatLng,
    departureTime: Date = new Date(),
    walkingSpeedMps: number = 1.4, // WALK_SPEED_MPS.NORMAL
    maxWalkDistanceM: number = DEFAULT_MAX_WALK_DISTANCE_M,
    debugMode: boolean = false,
): Promise<GtfsRouteResult> {
    const dbPath = getCurrentDbPath();
    if (!dbPath) {
        throw new Error('No GTFS database selected. Import or pick one in Settings → GTFS data.');
    }
    const eng = await getEngine(dbPath);
    await refreshRealtime(eng);

    const today = departureTime;
    const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
    const departSecOfDay =
        today.getHours() * 3600 + today.getMinutes() * 60 + today.getSeconds();

    const collector = debugMode ? createDebugSinkCollector() : null;

    try {
        const result: RouteResult = await eng.computeRoute(
            origin,
            destination,
            departSecOfDay,
            toGtfsDateString(today),
            today.getDay(),
            toGtfsDateString(tomorrow),
            tomorrow.getDay(),
            walkingSpeedMps,
            maxWalkDistanceM,
            collector?.sink ?? undefined, // pass the plain-object `sink`, not the collector wrapper — see debugSinkCollector.ts's header note on classes vs plain-object callback interfaces. undefined (not null) confirmed correct for the None case from the generated binding's FfiConverterOptional.
        );

        // Per-stage timings from lib.rs's RouteResult.timings. "total" is the load time only; raptor_search is a separate entry.
        try { console.log(summarizeJourneys(result.journeys)); } catch { /* logging only */ }
        // Logging must never fail a route: fall back to the raw one-line format.
        try {
            console.log(formatTimings(result.timings));
        } catch (logErr) {
            console.log(
                '[gtfsRouterNative] stage timings: ' +
                result.timings.map(t => `${t.label}=${t.ms}`).join(' | ')
            );
        }

        return {
            journeys: result.journeys.map(toJourney),
            debug: collector?.toDebugInfo(),  // unchanged — toDebugInfo lives on the wrapper, not the sink
        };
    } catch (err) {
        // RouterError variants come through here (e.g. NoServiceFound).
        throw err as RouterError;
    }
}