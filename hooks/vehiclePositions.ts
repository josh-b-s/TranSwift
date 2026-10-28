import { useEffect, useState } from 'react';
import { getDb } from '@/services/db/sqliteDb';
import { fetchVehicleFixes } from '@/services/gtfs/realtime/vehiclePositions';
import { freshVehicles } from '@/services/gtfs/vehicles/vehicleFix';
import { attachRoutes, loadRouteLookup, pickVehicles, type MapVehicle } from '@/services/gtfs/vehicles/vehicleRoutes';

const REFRESH_MS = 15_000;
const NONE: MapVehicle[] = [];

/**
 * Live vehicles on the given routes (see `routeKey`), refreshed every 15 seconds while `enabled`. Does nothing
 * until a route is wanted and the feed has VehiclePositions URLs. A failed refresh is logged and the last
 * vehicles stay, so the markers do not vanish on a bad connection.
 */
export function useVehicles(wantedKeys: string[], enabled: boolean): MapVehicle[] {
    const [vehicles, setVehicles] = useState<MapVehicle[]>(NONE);
    // The effect restarts only when the set of routes changes, not when the array is rebuilt.
    const wantedId = [...wantedKeys].sort().join('\n');

    useEffect(() => {
        if (!enabled || wantedId === '') {
            setVehicles(NONE);
            return;
        }
        const wanted = new Set(wantedId.split('\n'));
        let cancelled = false;
        let running = false;

        const refresh = async () => {
            if (running) return;
            running = true;
            try {
                const fresh = freshVehicles(await fetchVehicleFixes(), Date.now());
                const mapped = attachRoutes(fresh, await loadRouteLookup(await getDb(), fresh));
                if (!cancelled) setVehicles(pickVehicles(mapped, wanted, Infinity));
            } catch (err) {
                console.warn('[vehicles] refresh failed, keeping the last positions:', err);
            } finally {
                running = false;
            }
        };

        refresh();
        const timer = setInterval(refresh, REFRESH_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [wantedId, enabled]);

    return vehicles;
}
