import type { MapVehicle } from './vehicleRoutes';

/** The trip a line is shown for, and the line (see `loadLineKeys`) of each trip id known. */
export type FocusedLine = { tripId: string; lineKeys: ReadonlyMap<string, string> };

/**
 * The vehicles to draw. With a line shown (a tapped vehicle, an open departure) only the vehicles on that trip's route
 * and terminus stay, at any zoom. Without one they are hidden when zoomed out, like the stop dots.
 */
export function visibleVehicles(vehicles: MapVehicle[], zoomedIn: boolean, focus: FocusedLine | null): MapVehicle[] {
    if (!focus) return zoomedIn ? vehicles : [];
    const line = focus.lineKeys.get(focus.tripId);
    return vehicles.filter(v => v.tripId !== null && (v.tripId === focus.tripId || (line !== undefined && focus.lineKeys.get(v.tripId) === line)));
}
