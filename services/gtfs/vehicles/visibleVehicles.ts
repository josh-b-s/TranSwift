import type { MapVehicle } from './vehicleRoutes';

/** The trip a line is shown for, and the line (see `loadLineKeys`) of each trip id known. */
export type FocusedLine = { tripId: string; lineKeys: ReadonlyMap<string, string> };

/**
 * The vehicles to draw. Zoomed out they are hidden, like the stop dots, except those on the shown trip's route and
 * terminus: showing a whole line zooms the map out, and its vehicles must stay.
 */
export function visibleVehicles(vehicles: MapVehicle[], zoomedIn: boolean, focus: FocusedLine | null): MapVehicle[] {
    if (zoomedIn) return vehicles;
    if (!focus) return [];
    const line = focus.lineKeys.get(focus.tripId);
    return vehicles.filter(v => v.tripId !== null && (v.tripId === focus.tripId || (line !== undefined && focus.lineKeys.get(v.tripId) === line)));
}
