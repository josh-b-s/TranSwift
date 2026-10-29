import gtfsRouterRust from '@mapapp/gtfs-router-rust';
import type { VehiclePositionInfo } from '@mapapp/gtfs-router-rust';
import { getActiveDatabaseEntry } from '../import/gtfsDbRegistry';
import type { VehicleFix } from '../vehicles/vehicleFix';
import { reportAuthFailure } from './authFailure';
import { fetchWithKey } from './realtimeHttp';

const { decodeVehiclePositions } = gtfsRouterRust.gtfs_router;

/**
 * Fetches the active feed's VehiclePositions URLs in parallel and decodes them in the engine. A URL that fails is
 * logged and skipped, so one bad feed does not hide the others' vehicles. Empty when no URLs are set.
 */
export async function fetchVehicleFixes(): Promise<VehicleFix[]> {
    const entry = await getActiveDatabaseEntry();
    const urls = entry?.vehicleUrls ?? [];
    if (!entry || urls.length === 0) return [];

    const results = await Promise.allSettled(urls.map(url => fetchWithKey(entry, url)));
    reportAuthFailure(entry, results);
    const feeds: ArrayBuffer[] = [];
    results.forEach((result, i) => {
        if (result.status === 'fulfilled') feeds.push(result.value);
        else console.warn(`[vehiclePositions] ${urls[i]} failed:`, result.reason);
    });
    if (feeds.length === 0) return [];

    return decodeVehiclePositions(feeds).map((v: VehiclePositionInfo): VehicleFix => ({
        key: v.key,
        label: v.label ?? null,
        tripId: v.tripId ?? null,
        routeId: v.routeId ?? null,
        latitude: v.latitude,
        longitude: v.longitude,
        bearing: v.bearing ?? null,
        speedMps: v.speedMps ?? null,
        timestampSec: v.timestampSec ?? null,
        currentStopSequence: v.currentStopSequence ?? null,
    }));
}
