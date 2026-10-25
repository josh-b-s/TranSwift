
import type { GtfsDebugInfo } from '@/services/gtfs/router/routeTypes';

export type Pt = { latitude: number; longitude: number };

export function keyOfPt(p: Pt): string {
    return `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`;
}

/**
 * One entry per RAPTOR route-check step (a round can hold several, one per pattern examined).
 * This is the single definition of what stepIndex means in the raptor phase, shared by debug.slice.ts and DebugMapOverlay.tsx.
 * `coords` is the full journey-so-far chain (see raptor.rs's backtrack_stop_chain). routeColor and routeName are the
 * pattern's GTFS values when the feed has them.
 */
export type RaptorStep = { round: number; coords: Pt[]; routeColor?: string; routeName?: string };

export function flattenRaptorSteps(routeChecks: GtfsDebugInfo['routeChecks']): RaptorStep[] {
    const steps: RaptorStep[] = [];
    (routeChecks ?? []).forEach((checksThisRound, round) => {
        checksThisRound.forEach(check => steps.push({
            round, coords: check.coords, routeColor: check.routeColor, routeName: check.routeName,
        }));
    });
    return steps;
}

/** Step count for the raptor phase, without building the array. */
export function raptorStepCount(data: GtfsDebugInfo): number {
    let total = 0;
    for (const checks of data.routeChecks ?? []) total += checks.length;
    return total;
}

/**
 * One entry per candidate seed path, in discovery order: the round where its destination first shows up in `bfsLevels`.
 * The single definition of one-at-a-time candidate stepping, shared by debug.slice.ts and DebugMapOverlay.tsx.
 * A path whose destination never appears falls back to the last round, so it still shows.
 */
export type BfsCandidateStep = { round: number; path: Pt[]; depth: number; pathIndex: number };

// seedPath endpoints come from trimmed GTFS shapes, so they sit near a bfsLevels stop but are never bit-for-bit equal to one.
// ~0.0005 deg is about 50 m: bigger than a shape-trim gap, smaller than the gap between two stops.
const MATCH_TOLERANCE_DEG = 0.0005;

function ptsNear(a: Pt, b: Pt): boolean {
    return Math.abs(a.latitude - b.latitude) < MATCH_TOLERANCE_DEG &&
        Math.abs(a.longitude - b.longitude) < MATCH_TOLERANCE_DEG;
}

export function flattenBfsCandidates(
    seedPaths: GtfsDebugInfo['seedPaths'],
    bfsLevels: GtfsDebugInfo['bfsLevels'],
    seedPathDepths?: GtfsDebugInfo['seedPathDepths'],
): BfsCandidateStep[] {
    const lastRound = Math.max(0, (bfsLevels?.length ?? 1) - 1);
    return (seedPaths ?? []).map((path, i) => {
        const dest = path[path.length - 1];
        const depth = seedPathDepths?.[i] ?? 0;
        if (!dest) return { round: lastRound, path, depth, pathIndex: i };
        const round = (bfsLevels ?? []).findIndex(level => level.some(p => ptsNear(p, dest)));
        return { round: round === -1 ? lastRound : round, path, depth, pathIndex: i };
    });
}

// ── Hop-colored candidate view ──
// Colors a candidate's own shape per hop. Independent of which candidates are visible (see debug.slice.ts's hopColorMode),
// and always shows every hop of every candidate.

/**
 * One hop (a transit boarding or a walk leg) of a candidate seed path, mirroring lib.rs's SeedPathHop.
 * `pathIndex` is kept after flattening so a candidate's hops can be found again.
 */
export type SeedPathHop = {
    pathIndex: number;
    hopIndex: number;
    coords: Pt[];
    isWalk: boolean;
    routeColor?: string;
};

// Cycled by hopIndex. Avoids BFS_HULL_COLOR (#3b82f6) and BFS_CANDIDATE_COLOR (#f59e0b) so hops don't look like them.
// Walk hops are always neutral gray: a footpath isn't a line.
const HOP_PALETTE = ['#ef4444', '#8b5cf6', '#10b981', '#f97316', '#0ea5e9', '#ec4899', '#14b8a6', '#eab308'];
export const WALK_HOP_COLOR = '#9ca3af';

/** Color for a hop: its GTFS route_color if present, else a palette color by hop_index, else the walk color. */
export function hopColor(hop: Pick<SeedPathHop, 'hopIndex' | 'isWalk' | 'routeColor'>): string {
    if (hop.routeColor) return `#${hop.routeColor.replace(/^#/, '')}`;
    if (hop.isWalk) return WALK_HOP_COLOR;
    return HOP_PALETTE[hop.hopIndex % HOP_PALETTE.length];
}

/**
 * Flattens every candidate's hops into one array, regardless of discovery round or bfsCandidateMode.
 * `seedPathHops` is GtfsDebugInfo['seedPathHops'], indexed by path_index.
 */
export function flattenHopColoredCandidates(seedPathHops: GtfsDebugInfo['seedPathHops']): SeedPathHop[] {
    const out: SeedPathHop[] = [];
    (seedPathHops ?? []).forEach((hops, pathIndex) => {
        (hops ?? []).forEach(hop => out.push({ ...hop, pathIndex }));
    });
    return out;
}

// ── Depth-colored candidate view ──
// Colors a whole candidate by its transfer-count tier (depth relative to the shortest meet, see seed_bfs.rs's rank_meets).
// Separate from hopColorMode, which colors the legs within one candidate. This is the flat view's default.

// Cycled by depth. Depth 0 (fewest transfers) gets the warmest color, so short and long shots read without a legend.
// Distinct from BFS_HULL_COLOR and HOP_PALETTE.
const DEPTH_PALETTE = ['#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#0ea5e9'];

/** Color for a candidate depth. Cycles through DEPTH_PALETTE, so any SAFETY_MARGIN_LEVELS value works. */
export function depthColor(depth: number): string {
    return DEPTH_PALETTE[depth % DEPTH_PALETTE.length];
}
