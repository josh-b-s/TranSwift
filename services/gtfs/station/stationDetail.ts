import { pathTo, shortestPaths, type PathwayEdge } from './pathwayGraph';
import { isStepFree, routeSteps, type RouteStep } from './routeSteps';

export const LOCATION_ENTRANCE = 2;

export type PlatformInput = { stopPk: number; stopId: string; name: string; platformCode: string | null; levelId: string | null };
export type NodeInput = { nodeId: string; name: string | null; locationType: number; levelId: string | null };

export type StationInput = {
    stationName: string | null;
    /** The stop whose sheet is open. */
    current: PlatformInput;
    /** Every boarding stop of the station, `current` included. */
    platforms: PlatformInput[];
    nodes: NodeInput[];
    levelNames: Map<string, string>;
    edges: PathwayEdge[];
    /** "96 to Brunswick" lines per stop_pk. */
    toward: Map<number, string[]>;
};

export type StationPlatform = {
    stopPk: number;
    name: string;
    platformCode: string | null;
    levelName: string | null;
    toward: string[];
    isCurrent: boolean;
};

export type StationExit = {
    name: string;
    levelName: string | null;
    /** Directions from the current platform. Empty when the feed has no pathway that reaches this exit. */
    steps: RouteStep[];
    seconds: number | null;
    /** null when there is no route to judge. */
    stepFree: boolean | null;
};

export type StationDetail = { stationName: string | null; platforms: StationPlatform[]; exits: StationExit[] };

const collator = new Intl.Collator(undefined, { numeric: true });

export function buildStationDetail(input: StationInput): StationDetail {
    const levelName = (id: string | null) => (id ? input.levelNames.get(id) ?? null : null);

    const platforms = input.platforms
        .map((p): StationPlatform => ({
            stopPk: p.stopPk,
            name: p.name,
            platformCode: p.platformCode,
            levelName: levelName(p.levelId),
            toward: input.toward.get(p.stopPk) ?? [],
            isCurrent: p.stopPk === input.current.stopPk,
        }))
        .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || collator.compare(a.platformCode ?? a.name, b.platformCode ?? b.name));

    const names = new Map<string, string>();
    for (const p of input.platforms) names.set(p.stopId, p.platformCode ? `platform ${p.platformCode}` : p.name);
    for (const n of input.nodes) if (n.name) names.set(n.nodeId, n.name);

    const paths = shortestPaths(input.edges, input.current.stopId);
    const exits = input.nodes
        .filter(n => n.locationType === LOCATION_ENTRANCE && n.name)
        .map((n): StationExit => {
            const hops = pathTo(paths, n.nodeId);
            return {
                name: n.name!,
                levelName: levelName(n.levelId),
                steps: hops ? routeSteps(hops, id => names.get(id) ?? null) : [],
                seconds: hops ? hops.reduce((sum, h) => sum + h.seconds, 0) : null,
                stepFree: hops ? isStepFree(hops) : null,
            };
        })
        // Quickest first; exits with no known route go last, by name.
        .sort((a, b) => (a.seconds ?? Infinity) - (b.seconds ?? Infinity) || collator.compare(a.name, b.name));

    return { stationName: input.stationName, platforms, exits };
}
