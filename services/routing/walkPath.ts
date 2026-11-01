import type { LatLng } from '@/services/places/places';

const ENDPOINT = 'https://api.geoapify.com/v1/routing';
const API_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_KEY;
// Four decimals is about 11 m, so a re-search from nearly the same spot reuses the request.
const KEY_DECIMALS = 4;

const cache = new Map<string, Promise<LatLng[]>>();

export const hasWalkRouting = Boolean(API_KEY);

type RoutingResponse = { features?: Array<{ geometry: { coordinates: number[][][] } }> };

/** Flattens the response's MultiLineString into one path, dropping the point repeated where legs join. */
export function parseWalkPath(json: RoutingResponse): LatLng[] {
    const lines = json.features?.[0]?.geometry.coordinates;
    if (!lines) throw new Error('Walk route response has no geometry');
    const path: LatLng[] = [];
    for (const [lon, lat] of lines.flat()) {
        const last = path[path.length - 1];
        if (last && last.latitude === lat && last.longitude === lon) continue;
        path.push({ latitude: lat, longitude: lon });
    }
    return path;
}

async function request(from: LatLng, to: LatLng): Promise<LatLng[]> {
    const waypoints = `${from.latitude},${from.longitude}|${to.latitude},${to.longitude}`;
    const res = await fetch(`${ENDPOINT}?waypoints=${waypoints}&mode=walk&apiKey=${API_KEY}`);
    if (!res.ok) throw new Error(`Walk route request failed: ${res.status}`);
    return parseWalkPath(await res.json());
}

/** The footpath between two points, snapped to the road network. Rejects when the request fails. */
export function fetchWalkPath(from: LatLng, to: LatLng): Promise<LatLng[]> {
    const round = (n: number) => n.toFixed(KEY_DECIMALS);
    const key = `${round(from.latitude)},${round(from.longitude)}|${round(to.latitude)},${round(to.longitude)}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const pending = request(from, to);
    cache.set(key, pending);
    // A failed request is not worth keeping, so the next search can retry it.
    pending.catch(() => cache.delete(key));
    return pending;
}
