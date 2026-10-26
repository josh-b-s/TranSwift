import type { MapStyleElement } from 'react-native-maps';

/** Google's own bus and train stop icons, hidden so they don't sit under the app's stop circles. Android only. */
export const HIDE_GOOGLE_TRANSIT: MapStyleElement[] = [
    { featureType: 'transit.station', stylers: [{ visibility: 'off' }] },
];
