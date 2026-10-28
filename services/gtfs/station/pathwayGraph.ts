export const MODE_WALKWAY = 1;
export const MODE_STAIRS = 2;
export const MODE_MOVING_WALKWAY = 3;
export const MODE_ESCALATOR = 4;
export const MODE_ELEVATOR = 5;
export const MODE_FARE_GATE = 6;
export const MODE_EXIT_GATE = 7;

export type PathwayEdge = {
    fromId: string;
    toId: string;
    mode: number;
    bidirectional: boolean;
    lengthM: number | null;
    seconds: number | null;
    stairCount: number | null;
    signpost: string | null;
    reverseSignpost: string | null;
};

/** An edge as walked: its ends are in the order the rider crosses it, and the signpost is the one facing them. */
export type Hop = {
    fromId: string;
    toId: string;
    mode: number;
    seconds: number;
    stairCount: number | null;
    signpost: string | null;
};

// Used when a pathway gives neither a traversal time nor a length.
const DEFAULT_HOP_SEC = 20;
const WALKING_SPEED_MPS = 1.2;

const hopSeconds = (e: PathwayEdge) =>
    e.seconds ?? (e.lengthM !== null ? Math.round(e.lengthM / WALKING_SPEED_MPS) : DEFAULT_HOP_SEC);

/** Each edge in the direction it can be crossed, plus its reverse when it is bidirectional. */
function directedHops(edges: PathwayEdge[]): Map<string, Hop[]> {
    const out = new Map<string, Hop[]>();
    const add = (hop: Hop) => out.set(hop.fromId, [...(out.get(hop.fromId) ?? []), hop]);
    for (const e of edges) {
        const seconds = hopSeconds(e);
        add({ fromId: e.fromId, toId: e.toId, mode: e.mode, seconds, stairCount: e.stairCount, signpost: e.signpost });
        if (e.bidirectional) {
            add({ fromId: e.toId, toId: e.fromId, mode: e.mode, seconds, stairCount: e.stairCount, signpost: e.reverseSignpost });
        }
    }
    return out;
}

export type ShortestPaths = { seconds: Map<string, number>; via: Map<string, Hop> };

/** Quickest way from `startId` to every node it can reach (Dijkstra; a station has tens of nodes, so no heap). */
export function shortestPaths(edges: PathwayEdge[], startId: string): ShortestPaths {
    const hops = directedHops(edges);
    const seconds = new Map<string, number>([[startId, 0]]);
    const via = new Map<string, Hop>();
    const done = new Set<string>();

    for (;;) {
        let current: string | null = null;
        for (const [id, s] of seconds) {
            if (!done.has(id) && (current === null || s < seconds.get(current)!)) current = id;
        }
        if (current === null) break;
        done.add(current);
        for (const hop of hops.get(current) ?? []) {
            const total = seconds.get(current)! + hop.seconds;
            if (total < (seconds.get(hop.toId) ?? Infinity)) {
                seconds.set(hop.toId, total);
                via.set(hop.toId, hop);
            }
        }
    }
    return { seconds, via };
}

/** The hops from the start of `paths` to `targetId` in order, or null when it cannot be reached. */
export function pathTo(paths: ShortestPaths, targetId: string): Hop[] | null {
    if (!paths.seconds.has(targetId)) return null;
    const hops: Hop[] = [];
    for (let hop = paths.via.get(targetId); hop; hop = paths.via.get(hop.fromId)) hops.unshift(hop);
    return hops;
}
