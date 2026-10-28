import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { tripToGpx } from './gpx';
import type { SavedTrip } from './tripStore';

async function shareFile(uri: string, mimeType: string, uti: string, dialogTitle: string) {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
    await Sharing.shareAsync(uri, { mimeType, UTI: uti, dialogTitle });
}

/** Writes the trip as a .gpx file in the cache and opens the share sheet for it. */
export async function shareTripGpx(trip: SavedTrip): Promise<void> {
    const uri = `${FileSystem.cacheDirectory}trip-${trip.startedAt}.gpx`;
    await FileSystem.writeAsStringAsync(uri, tripToGpx(trip));
    await shareFile(uri, 'application/gpx+xml', 'com.topografix.gpx', 'Share trip');
}

/** Writes a base64 PNG of the trip card in the cache and opens the share sheet for it. */
export async function shareTripCard(startedAt: number, pngBase64: string): Promise<void> {
    const uri = `${FileSystem.cacheDirectory}trip-${startedAt}.png`;
    await FileSystem.writeAsStringAsync(uri, pngBase64, { encoding: FileSystem.EncodingType.Base64 });
    await shareFile(uri, 'image/png', 'public.png', 'Share trip card');
}
