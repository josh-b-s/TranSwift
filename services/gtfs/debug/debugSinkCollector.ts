// debugSinkCollector.ts
// Bridges the Rust engine's DebugEvent callback stream into one batched GtfsDebugInfo for debug.slice.ts and DebugMapOverlay.tsx.
//
// DebugSink is a TS interface, so ubrn needs a plain object literal, not a class instance. A class threw
// "Cannot lower this object to a pointer" the first time a real search passed one in (same pattern as
// rustGtfsImporter.ts's progressCallback).
//
// Two phases: "bfs" (corridor finding: seed paths and the tapered boundary, stepped per BFS round) and
// "raptor" (stepped per candidate-route check). See debugBfsPoints.ts and DebugMapOverlay.tsx.
//
// seedPaths coords come from the pattern's real GTFS shape, trimmed to the ridden part, where Rust could resolve one.
// Each SeedPath event carries { pathIndex, hops }. seedPathHops keeps the hops, and seedPaths is rebuilt by joining
// them and dropping the duplicated join points.
//
// Gaps in GtfsDebugInfo (see lib.rs's DebugEvent): no bfsTreeEdges (Rust sends per-level snapshots), no corridorStops
// (only corridorBoundary), no walkRadiusCircles (DebugMapOverlay defaults it to []).
//
// compute_route() retries once with a wider window and re-emits the pre-search events on the same sink. Candidates and
// levels are written by index, so a retry overwrites the first attempt. routeChecks and roundMarkedStops are not:
// a retry's round 0 collides with the first attempt's.

import {DebugEvent_Tags} from '@/modules/gtfs-router-rust';
import type {DebugEvent, DebugSink} from '@/modules/gtfs-router-rust';
import type {GtfsDebugInfo} from '../router/routeTypes';
import type {Pt, SeedPathHop} from '../debug/debugBfsPoints';

export interface DebugCollectorHandle {
    sink: DebugSink; // plain object literal — pass THIS to compute_route's debug param
    toDebugInfo: () => GtfsDebugInfo;
}

/** Creates a fresh collector. Call once per search: debugMode ? createDebugSinkCollector() : null. */
export function createDebugSinkCollector(): DebugCollectorHandle {
    const bfsLevels: GtfsDebugInfo['bfsLevels'] = [];
    // Written by path_index, so a retry's re-emitted candidate overwrites instead of duplicating.
    const seedPathHops: SeedPathHop[][] = [];
    // Depth of each candidate relative to the shortest meet, by pathIndex (lib.rs's SeedPath.depth).
    // Lets rendering color by transfer-count tier.
    const seedPathDepths: number[] = [];
    const corridorBoundary: GtfsDebugInfo['corridorBoundary'] = [];
    const roundMarkedStops: GtfsDebugInfo['roundMarkedStops'] = [];
    // Every candidate-route polyline RAPTOR examined, per round. The one-at-a-time reveal lives in DebugMapOverlay's stepIndex logic.
    const routeChecks: GtfsDebugInfo['routeChecks'] = [];

    const sink: DebugSink = {
        // Rust sends every pre-search event in one batch (lib.rs's DebugSink::on_event_batch): one bridge crossing per search.
        onEventBatch(events: DebugEvent[]): void {
            for (const event of events) handleEvent(event);
        },
    };

    function handleEvent(event: DebugEvent): void {
            switch (event.tag) {
                case DebugEvent_Tags.SeedBfsLevel:
                    // Written by index rather than pushed, so a re-emitted level 0 on retry overwrites.
                    bfsLevels[event.inner.level] = event.inner.stops;
                    break;
                case DebugEvent_Tags.SeedPath:
                    // Each event carries one candidate's hops and depth; written by pathIndex.
                    seedPathHops[event.inner.pathIndex] = event.inner.hops.map(h => ({
                        pathIndex: event.inner.pathIndex,
                        hopIndex: h.hopIndex,
                        coords: h.coords,
                        isWalk: h.isWalk,
                        routeColor: h.routeColor ?? undefined,
                    }));
                    seedPathDepths[event.inner.pathIndex] = event.inner.depth;
                    break;
                case DebugEvent_Tags.CorridorBoundary:
                    corridorBoundary.push({left: event.inner.left, right: event.inner.right});
                    break;
                case DebugEvent_Tags.RaptorRound:
                    roundMarkedStops[event.inner.round] = event.inner.markedStops;
                    break;
                case DebugEvent_Tags.RaptorRouteCheck:
                    // Appends within the round's bucket, since many patterns are checked per round. `coords` is the full journey-so-far
                    // chain; routeColor and routeName come straight off the event.
                    (routeChecks[event.inner.round] ??= []).push({
                        coords: event.inner.coords,
                        routeColor: event.inner.routeColor ?? undefined,
                        routeName: event.inner.routeName ?? undefined,
                    });
                    break;
            }
    }

    /**
     * Rebuilds the one-polyline-per-candidate `seedPaths` from `seedPathHops`, dropping the duplicated join points,
     * for consumers that don't care about hop boundaries.
     */
    function rebuildFlatSeedPaths(): Pt[][] {
        return seedPathHops.filter(Boolean).map(hops => {
            const pts: Pt[] = [];
            for (const hop of hops) {
                const seg = hop.coords;
                if (pts.length > 0 && seg.length > 0 &&
                    pts[pts.length - 1].latitude === seg[0].latitude &&
                    pts[pts.length - 1].longitude === seg[0].longitude) {
                    pts.push(...seg.slice(1));
                } else {
                    pts.push(...seg);
                }
            }
            return pts;
        });
    }

    return {
        sink,
        toDebugInfo(): GtfsDebugInfo {
            return {
                corridorStops: [], // not reported by the Rust side — see header note
                seedPaths: rebuildFlatSeedPaths(),
                seedPathHops: seedPathHops.filter(Boolean),
                seedPathDepths: seedPathHops.map((hops, i) => hops ? (seedPathDepths[i] ?? 0) : undefined).filter((d): d is number => d !== undefined),
                bfsLevels: bfsLevels.filter(Boolean), // drop any holes from out-of-order writes
                bfsTreeEdges: [], // not reported by the Rust side — see header note
                roundMarkedStops: roundMarkedStops.filter(Boolean),
                routeChecks: routeChecks.map(r => r ?? []), // preserve round index, no holes
                corridorBoundary,
                walkRadiusCircles: [], // not reported by the Rust side — see header note
            };
        },
    };
}
