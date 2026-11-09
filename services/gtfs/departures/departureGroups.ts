import type { Departure } from './stopDepartures';

export type DepartureGroup<T extends Departure> = {
    key: string;
    routeName: string;
    routeType: number;
    routeColor: string;
    routeTextColor: string;
    terminus: string;
    /** In the order given, which is by time. */
    departures: T[];
};

/** Departures gathered by line and destination, the groups ordered by their first departure. */
export function groupDepartures<T extends Departure>(departures: T[]): DepartureGroup<T>[] {
    const groups = new Map<string, DepartureGroup<T>>();
    for (const d of departures) {
        const key = `${d.routeName}|${d.routeType}|${d.terminus}`;
        const group = groups.get(key);
        if (group) group.departures.push(d);
        else groups.set(key, {
            key,
            routeName: d.routeName,
            routeType: d.routeType,
            routeColor: d.routeColor,
            routeTextColor: d.routeTextColor,
            terminus: d.terminus,
            departures: [d],
        });
    }
    return [...groups.values()];
}
