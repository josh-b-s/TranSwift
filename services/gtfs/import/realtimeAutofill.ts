import { loadRealtimeEndpoints } from '../catalog/feedCatalog';
import { setRealtimeAuthHint, setRealtimeConfig, type GtfsDatabaseEntry } from './gtfsDbRegistry';

/** Sets a catalog feed's realtime URLs from the Mobility Database. Does nothing when it lists none. */
export async function autofillRealtime(entry: GtfsDatabaseEntry): Promise<void> {
    if (!entry.source) return;
    const found = await loadRealtimeEndpoints(entry.source.id);
    if (found.tripUpdates.length + found.vehiclePositions.length + found.serviceAlerts.length === 0) return;
    await setRealtimeConfig(entry.id, {
        tripUrls: found.tripUpdates,
        vehicleUrls: found.vehiclePositions,
        alertUrls: found.serviceAlerts,
        header: '',
        query: '',
    });
    if (found.auth) await setRealtimeAuthHint(entry.id, found.auth);
}
