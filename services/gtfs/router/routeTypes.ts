import type { LatLng } from '@/services/db/sqliteDb';
import type { SeedPathHop } from '@/services/gtfs/debug/debugBfsPoints';

export interface RouteStop extends LatLng {
    name: string;
}

export interface RouteSegment {
    coords: LatLng[];
    routeName: string;
    routeType: number;
    routeColor?: string;
    routeTextColor?: string;
    originStopName: string;
    destStopName: string;
    type: 'transit' | 'walk';
    departureTime?: string;
    arrivalTime?: string;
    /** Every stop a ride passes, board to alight. Absent on walks. */
    stops?: RouteStop[];
}

export interface GtfsJourney {
    coords: LatLng[];
    segments: RouteSegment[];
    legs: Array<{
        routeName: string; routeType: number; routeColor?: string; routeTextColor?: string;
        originStopName: string; destStopName: string; departureTime?: string; arrivalTime?: string;
        /** Realtime delay already included in departureTime; 0 or absent when on time. */
        departureDelaySec?: number;
    }>;
    routeName: string;
    routeType: number;
    routeColor?: string;
    routeTextColor?: string;
    originStopName: string;
    destStopName: string;
    transferStopName?: string;
    totalDurationMin: number;
    totalWalkingMeters: number;
    transferCount: number;
    departureTime: string;
    arrivalTime: string;
}

export interface GtfsDebugInfo {
    /** Every stop the corridor filter kept, for drawing "here's the search
     *  space" on the map. */
    corridorStops: LatLng[];
    /** The raw BFS seed paths the corridor was tapered around — one
     *  polyline per path, in origin->destination order. */
    seedPaths: LatLng[][];
    /** Per-candidate, ordered hop list. */
    seedPathHops: SeedPathHop[][];
    /** Depth (relative to the shortest meet BFS found — see seed_bfs.rs's
     *  rank_meets depth-bucketing) of the matching entry in `seedPaths`/
     *  `seedPathHops`. Lets a debug overlay color candidates by
     *  transfer-count tier. */
    seedPathDepths: number[];

    /** BFS's frontier at the end of each level, in order — level 0 is the
     *  origin seed set. Lets a debug replay show the coarse-graph search
     *  expanding outward before any of the corridor/RAPTOR stages. */
    bfsLevels: LatLng[][];
    /** The BFS exploration tree's (parent, child) edges as LatLng pairs —
     *  lets a debug overlay draw the search as a connected "web" (merged
     *  polylines along tree branches) instead of per-stop dots. */
    bfsTreeEdges: { from: LatLng; to: LatLng }[];
    /** RAPTOR's marked-stop set at the END of each round, one entry per
     *  round actually run. Lets a debug overlay show the search frontier
     *  expanding round by round. */
    roundMarkedStops: LatLng[][];
    /** One tapered-buffer outline per seed path (left/right boundary
     *  polylines) — lets a debug overlay draw the corridor as a single
     *  shape instead of scattering a marker over every tagged stop. */
    corridorBoundary: { left: LatLng[]; right: LatLng[] }[];
    /** Fixed walk-tolerance radius circles at origin/destination. They are
     *  unioned into the real corridor regardless of the taper, so without
     *  drawing them the debug view understates the corridor at both ends. */
    walkRadiusCircles: { center: LatLng; radiusMeters: number }[];
    /** RAPTOR route-check polylines, one list per round — every individual
     *  candidate route examined during that round. Meant to be displayed
     *  one at a time (see DebugMapOverlay.tsx's flattenRaptorSteps), not
     *  accumulated. */
    routeChecks: LatLng[][][];
}

export interface GtfsRouteResult {
    journeys: GtfsJourney[]; // sorted by arrival time ascending; caller can re-sort
    /** Only populated when computeGtfsRouteNative is called with debugMode=true —
     *  omitted entirely otherwise so normal searches pay zero cost for this. */
    debug?: GtfsDebugInfo;
}
