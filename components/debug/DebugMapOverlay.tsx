import React, { useMemo } from 'react';
import { Polygon, Polyline, Marker, LatLng as MapLatLng } from 'react-native-maps';
import { View, Text } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { flattenRaptorSteps, flattenHopColoredCandidates, hopColor, depthColor } from '@/services/gtfs/debug/debugBfsPoints';
import { useDebugData, useBfsCandidateSteps } from '@/services/gtfs/debug/debugDataStore';

const BFS_HULL_COLOR = '#3b82f6';
const RAPTOR_HULL_COLOR = '#ef4444';
// Fallback only: route-check polylines normally use the pattern's GTFS route_color (see raptorView).
const RAPTOR_ROUTE_COLOR_FALLBACK = '#ef4444';

type Pt = { latitude: number; longitude: number };

/**
 * Convex hull (monotone chain) of a small set of lat/lon points, used for both the BFS frontier and RAPTOR's marked stops.
 * A Polygon is one native object however many points it has. A <Circle> per stop meant thousands of native allocations
 * (corridor stops hit 1359, RAPTOR rounds 2000-3000) and ran out of memory.
 * Returns the points as-is for fewer than 3.
 */
function convexHull(points: Pt[]): Pt[] {
    if (points.length < 3) return points;

    // Sort by longitude then latitude — arbitrary but consistent axis choice.
    const sorted = [...points].sort((a, b) => a.longitude - b.longitude || a.latitude - b.latitude);

    const cross = (o: Pt, a: Pt, b: Pt) =>
        (a.longitude - o.longitude) * (b.latitude - o.latitude) -
        (a.latitude - o.latitude) * (b.longitude - o.longitude);

    const lower: Pt[] = [];
    for (const p of sorted) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
            lower.pop();
        }
        lower.push(p);
    }

    const upper: Pt[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
        const p = sorted[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
            upper.pop();
        }
        upper.push(p);
    }

    // Each list's last point is the other's first. Drop the duplicates before closing the ring.
    upper.pop();
    lower.pop();
    return [...lower, ...upper];
}

/** Middle point of a polyline by point count, good enough for placing a label. */
function midpoint(coords: Pt[]): Pt {
    return coords[Math.floor(coords.length / 2)];
}

/**
 * Route-name pill anchored at a route's midpoint. Only used in the raptor phase, where a candidate is a single pattern
 * with an unambiguous name.
 */
function RouteNameLabel({ coords, name, color }: { coords: Pt[]; name?: string; color: string }) {
    if (!name || coords.length === 0) return null;
    const at = midpoint(coords);
    return (
        <Marker coordinate={at as MapLatLng} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={{ backgroundColor: color, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{name}</Text>
            </View>
        </Marker>
    );
}

/**
 * Renders the current step of the last debug search (not a replay, except bfs 'cumulative' mode).
 * Must be a child of <MapView>; renders nothing when debug is off or has no data.
 *
 * bfs: two independent toggles from DebugControls.tsx. bfsCandidateMode ('cumulative' | 'single') decides which
 * candidates are visible, see bfsView. hopColorMode decides how they are colored: when true, each visible candidate's
 * hops are drawn via hopColor() (route_color, else a per-hop palette, else gray for walks) instead of the flat view.
 * The round hull stays underneath either way. Candidates use each pattern's GTFS shape trimmed to the ridden part when
 * Rust could resolve one (lib.rs's shaped_edge_coords).
 *
 * raptor: one candidate-route check per step, replaced each step. The polyline is the full journey so far, colored by
 * the pattern's route_color and labeled via RouteNameLabel, with the round's marked-stop hull beside it.
 * hopColorMode has no effect here.
 */
export default function DebugMapOverlay() {
    const { enabled, phase, stepIndex, bfsCandidateMode, hopColorMode } = useSelector((s: RootState) => s.debug);
    // Data lives outside Redux (debugDataStore.ts); candidate steps are computed once per search there.
    const data = useDebugData();
    const bfsCandidateSteps = useBfsCandidateSteps();

    const bfsView = useMemo(() => {
        if (!data || phase !== 'bfs') return null;
        const levels = data.bfsLevels ?? [];

        if (bfsCandidateMode === 'single') {
            if (bfsCandidateSteps.length === 0) return null;
            const candidate = bfsCandidateSteps[Math.min(stepIndex, bfsCandidateSteps.length - 1)];
            const hull = convexHull(levels[candidate.round] ?? []);
            return { hull, candidates: candidate.path.length >= 2 ? [{ path: candidate.path, depth: candidate.depth, pathIndex: candidate.pathIndex }] : [] };
        }

        // 'cumulative' — stepIndex is a round number here.
        const round = Math.min(stepIndex, Math.max(0, levels.length - 1));
        const hull = convexHull(levels[round] ?? []);

        // Candidates found so far grow as stepIndex advances. Uses bfsCandidateSteps' per-candidate round as the single source
        // for discovery round. Matching bfsLevels by exact keyOfPt() equality broke once seedPath endpoints came from trimmed
        // shapes (see debugBfsPoints.ts's tolerance match) and showed zero candidates.
        const candidates = bfsCandidateSteps
            .filter(c => c.round <= round && c.path.length > 1)
            .map(c => ({ path: c.path, depth: c.depth, pathIndex: c.pathIndex }));

        return { hull, candidates };
    }, [data, phase, stepIndex, bfsCandidateMode, bfsCandidateSteps]);

    // Hop-colored view: every hop of the candidates bfsView currently shows (one in 'single' mode, the round-gated set in
    // 'cumulative'). Ignoring stepIndex here once made single mode look stuck, with every candidate overlaid.
    const hopColoredHops = useMemo(() => {
        if (!data || phase !== 'bfs' || !hopColorMode || !bfsView) return [];
        const visiblePathIndices = new Set(bfsView.candidates.map(c => c.pathIndex));
        return flattenHopColoredCandidates(data.seedPathHops).filter(hop => visiblePathIndices.has(hop.pathIndex));
    }, [data, phase, hopColorMode, bfsView]);

    const raptorSteps = useMemo(() => {
        if (!data) return [];
        return flattenRaptorSteps(data.routeChecks ?? []);
    }, [data]);

    const raptorView = useMemo(() => {
        if (!data || phase !== 'raptor' || raptorSteps.length === 0) return null;
        const step = raptorSteps[Math.min(stepIndex, raptorSteps.length - 1)];
        const hull = convexHull(data.roundMarkedStops[step.round] ?? []);
        return { route: step.coords, hull, routeColor: step.routeColor ?? RAPTOR_ROUTE_COLOR_FALLBACK, routeName: step.routeName };
    }, [data, phase, stepIndex, raptorSteps]);

    if (!enabled || !data) return null;

    return (
        <>
            {phase === 'bfs' && bfsView && bfsView.hull.length >= 3 && (
                <Polygon
                    coordinates={bfsView.hull as MapLatLng[]}
                    strokeWidth={1.5}
                    strokeColor={BFS_HULL_COLOR}
                    fillColor={`${BFS_HULL_COLOR}22`}
                />
            )}

            {/* Flat candidate view, suppressed when hopColorMode is on. Colored by depth: fewer transfers read warmer. */}
            {phase === 'bfs' && !hopColorMode && bfsView?.candidates.map(({ path, depth }, i) => (
                path.length >= 2 && (
                    <Polyline
                        key={`bfs-candidate-${i}`}
                        coordinates={path as MapLatLng[]}
                        strokeWidth={4}
                        strokeColor={depthColor(depth)}
                    />
                )
            ))}

            {/* Hop-colored candidate view: every hop of the visible candidates, colored by hopColor(). */}
            {phase === 'bfs' && hopColorMode && hopColoredHops.map(hop => (
                hop.coords.length >= 2 && (
                    <Polyline
                        key={`bfs-hop-${hop.pathIndex}-${hop.hopIndex}`}
                        coordinates={hop.coords as MapLatLng[]}
                        strokeWidth={hop.isWalk ? 3 : 4}
                        lineDashPattern={hop.isWalk ? [6, 6] : undefined}
                        strokeColor={hopColor(hop)}
                    />
                )
            ))}

            {/* RAPTOR's marked-stop frontier for the round of the current check, as context. */}
            {phase === 'raptor' && raptorView && raptorView.hull.length >= 3 && (
                <Polygon
                    coordinates={raptorView.hull as MapLatLng[]}
                    strokeWidth={1.5}
                    strokeColor={RAPTOR_HULL_COLOR}
                    fillColor={`${RAPTOR_HULL_COLOR}22`}
                />
            )}

            {/* The focus of the raptor phase: one candidate route, replaced each step, in the pattern's route_color with its name via RouteNameLabel. */}
            {phase === 'raptor' && raptorView && raptorView.route.length >= 2 && (
                <>
                    <Polyline
                        coordinates={raptorView.route as MapLatLng[]}
                        strokeWidth={4}
                        strokeColor={raptorView.routeColor}
                    />
                    <RouteNameLabel coords={raptorView.route} name={raptorView.routeName} color={raptorView.routeColor} />
                </>
            )}
        </>
    );
}
