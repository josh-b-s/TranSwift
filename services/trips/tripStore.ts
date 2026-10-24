import * as FileSystem from 'expo-file-system/legacy';
import type { EncodedPath } from './pathCodec';
import type { BrokenRecord } from './personalBests';

/** A walk with the rider's recorded path. */
export type WalkLeg = {
    kind: 'walk';
    stepIndex: number;
    from: string;
    to: string;
    bestKey?: string;
    path: EncodedPath;
};

/** A ride with the line it followed, not the rider's own movement. */
export type RideLeg = {
    kind: 'ride';
    stepIndex: number;
    from: string;
    to: string;
    routeName: string;
    routeType: number;
    routeColor?: string;
    routeTextColor?: string;
    line: string;
};

export type SavedLeg = WalkLeg | RideLeg;

/** Walking figures kept beside the encoded paths, so history can read them without decoding. */
export type WalkTotals = { distanceM: number; durationS: number; topSpeedMps: number };

export type SavedTrip = {
    startedAt: number;
    legs: SavedLeg[];
    /** Records this trip broke. */
    records: BrokenRecord[];
    /** Missing on trips saved before it existed; see loadHistory. */
    totals?: WalkTotals;
};

const TRIPS_DIR = `${FileSystem.documentDirectory}trips/`;
const tripPath = (startedAt: number) => `${TRIPS_DIR}${startedAt}.json`;

export async function saveTrip(trip: SavedTrip): Promise<void> {
    await FileSystem.makeDirectoryAsync(TRIPS_DIR, { intermediates: true });
    await FileSystem.writeAsStringAsync(tripPath(trip.startedAt), JSON.stringify(trip));
}

export async function loadTrip(startedAt: number): Promise<SavedTrip> {
    return JSON.parse(await FileSystem.readAsStringAsync(tripPath(startedAt))) as SavedTrip;
}

/** Every saved trip, newest first. */
export async function listTrips(): Promise<SavedTrip[]> {
    if (!(await FileSystem.getInfoAsync(TRIPS_DIR)).exists) return [];
    const names = (await FileSystem.readDirectoryAsync(TRIPS_DIR)).filter(name => name.endsWith('.json'));
    const trips = await Promise.all(
        names.map(async name => JSON.parse(await FileSystem.readAsStringAsync(`${TRIPS_DIR}${name}`)) as SavedTrip),
    );
    return trips.sort((a, b) => b.startedAt - a.startedAt);
}

export const deleteTrip = (startedAt: number) => FileSystem.deleteAsync(tripPath(startedAt), { idempotent: true });
