
export type ServiceAlert = {
    id: string;
    header: string | null;
    description: string | null;
    periods: { startSec: number | null; endSec: number | null }[];
    targets: { routeId: string | null; stopId: string | null; tripId: string | null }[];
};

/** An alert reduced to what the app can place: the stops and routes (see `routeKey`) it is about. */
export type ResolvedAlert = {
    id: string;
    header: string | null;
    description: string | null;
    stopIds: Set<string>;
    routeKeys: Set<string>;
};

/** No periods means the alert is always in effect. A missing end means it has not been closed. */
export function isActiveAt(alert: ServiceAlert, nowSec: number): boolean {
    if (alert.periods.length === 0) return true;
    return alert.periods.some(p => (p.startSec === null || p.startSec <= nowSec) && (p.endSec === null || nowSec < p.endSec));
}

/**
 * Places an alert on stops and routes. A selector naming a stop counts as a stop alert even when it also names a
 * route, since that is the narrower reading. Selectors for one trip, a whole agency or a route type are ignored, and
 * an alert left with nothing to attach to, or with no text, is dropped.
 */
export function resolveAlert(alert: ServiceAlert, routeKeyById: Map<string, string>): ResolvedAlert | null {
    if (!alert.header && !alert.description) return null;
    const stopIds = new Set<string>();
    const routeKeys = new Set<string>();
    for (const target of alert.targets) {
        if (target.tripId) continue;
        if (target.stopId) stopIds.add(target.stopId);
        else if (target.routeId) {
            const key = routeKeyById.get(target.routeId);
            if (key) routeKeys.add(key);
        }
    }
    if (stopIds.size === 0 && routeKeys.size === 0) return null;
    return { id: alert.id, header: alert.header, description: alert.description, stopIds, routeKeys };
}

/** Alerts about a stop or about any of the routes serving it. */
export function alertsForStop(alerts: ResolvedAlert[], stopId: string, routeKeys: string[]): ResolvedAlert[] {
    return alerts.filter(a => a.stopIds.has(stopId) || routeKeys.some(k => a.routeKeys.has(k)));
}

/** Alerts about any of the given routes. */
export function alertsForRoutes(alerts: ResolvedAlert[], keys: string[]): ResolvedAlert[] {
    return alerts.filter(a => keys.some(k => a.routeKeys.has(k)));
}
