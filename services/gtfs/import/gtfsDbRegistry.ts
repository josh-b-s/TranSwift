/**
 * gtfsDbRegistry.ts: the databases the user has imported, and which one is active.
 * Each import is its own file, `{documentDirectory}SQLite/gtfs-{id}.db`. The metadata sits in a small JSON file
 * because it has to be readable before any database is open.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { setActiveDbPath, clearActiveDbPath } from '@/services/db/sqliteDb';
import { invalidateNativeRouter } from '../router/gtfsRouterNative';
import { invalidateStopCache } from '../core/stopRepo';
import { invalidateStopColors } from '../departures/stopColors';
import { computeFeedStats, type FeedStats } from './gtfsFeedStats';
import type { RealtimeAuth } from '../catalog/realtimeParse';

/** Where a feed was downloaded from, kept for licence credit and later update checks. */
export type FeedSource = {
    /** Mobility Database feed id, used to find the feed again in the catalog. */
    id: string;
    label: string;
    url: string;
    license?: string;
    /** Validators the server sent with the zip, compared later to spot a newer version. */
    etag?: string;
    lastModified?: string;
};

export type GtfsDatabaseEntry = {
    id: string;
    name: string;
    fileName: string;
    importedAt: number;
    /** MD5 of the source zip, used to spot an already-imported feed. Older entries have none and never match. */
    zipHash?: string;
    /** Set for feeds imported from the catalog; absent for zips picked from the device. */
    source?: FeedSource;
    /** Computed once after import. Absent on entries imported before it existed. */
    stats?: FeedStats;
    /** GTFS-realtime TripUpdates URLs, e.g. one per transport mode. Set by hand; realtime is off without any. */
    realtimeUrls?: string[];
    /** GTFS-realtime VehiclePositions URLs. Vehicles are not drawn on the map without any. */
    vehicleUrls?: string[];
    /** Optional auth header sent with every realtime URL, written "Name: value". */
    realtimeHeader?: string;
    /** How the catalog says the realtime producer wants a key. Only a hint: the key itself is never stored here. */
    realtimeAuth?: RealtimeAuth;
    /** Set when most of a realtime feed's trip ids matched no trip here, which suggests an older timetable. */
    realtimeMismatch?: boolean;
};

type RegistryFile = {
    databases: GtfsDatabaseEntry[];
    activeId: string | null;
};

const SQLITE_DIR = `${FileSystem.documentDirectory}SQLite/`;
const REGISTRY_PATH = `${FileSystem.documentDirectory}gtfs-import/databases.json`;

async function readRegistry(): Promise<RegistryFile> {
    try {
        const raw = await FileSystem.readAsStringAsync(REGISTRY_PATH);
        const parsed = JSON.parse(raw) as RegistryFile;
        return { databases: parsed.databases ?? [], activeId: parsed.activeId ?? null };
    } catch {
        // No registry file yet (fresh install or first import).
        return { databases: [], activeId: null };
    }
}

async function writeRegistry(reg: RegistryFile): Promise<void> {
    const dir = REGISTRY_PATH.slice(0, REGISTRY_PATH.lastIndexOf('/') + 1);
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    await FileSystem.writeAsStringAsync(REGISTRY_PATH, JSON.stringify(reg, null, 2));
}

export function dbPathFor(entry: GtfsDatabaseEntry): string {
    return `${SQLITE_DIR}${entry.fileName}`;
}

export async function listDatabases(): Promise<GtfsDatabaseEntry[]> {
    const reg = await readRegistry();
    return [...reg.databases].sort((a, b) => b.importedAt - a.importedAt);
}

export async function getActiveDatabaseId(): Promise<string | null> {
    const reg = await readRegistry();
    return reg.activeId;
}

/** Finds an imported database whose source zip had this hash, so a duplicate feed is caught before the expensive import. */
export async function findDatabaseByHash(zipHash: string): Promise<GtfsDatabaseEntry | null> {
    const reg = await readRegistry();
    return reg.databases.find(d => d.zipHash === zipHash) ?? null;
}

/** Strips a trailing .zip (case-insensitive) so "melbourne-gtfs.zip" -> "melbourne-gtfs". */
export function nameFromZipFileName(zipFileName: string): string {
    return zipFileName.replace(/\.zip$/i, '');
}

/** Thrown by renameDatabase() so the settings screen can show a specific message. */
export class DuplicateNameError extends Error {
    constructor(name: string) {
        super(`"${name}" is already in use by another feed.`);
        this.name = 'DuplicateNameError';
    }
}

/** Thrown by gtfsDbImport.ts when the zip matches an imported feed, so the settings screen can offer the existing one. */
export class DuplicateFeedError extends Error {
    existing: GtfsDatabaseEntry;
    constructor(existing: GtfsDatabaseEntry) {
        super(`This exact feed is already imported as "${existing.name}".`);
        this.name = 'DuplicateFeedError';
        this.existing = existing;
    }
}

function namesCollide(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Appends " (1)", " (2)" and so on until the name no longer collides, ignoring case.
 * Imports do this silently; renameDatabase() rejects a collision instead.
 */
function dedupeName(candidate: string, existingNames: string[]): string {
    if (!existingNames.some(n => namesCollide(n, candidate))) return candidate;
    let n = 1;
    let attempt = `${candidate} (${n})`;
    while (existingNames.some(existing => namesCollide(existing, attempt))) {
        n += 1;
        attempt = `${candidate} (${n})`;
    }
    return attempt;
}

/** Drops everything cached from the previous database: the router engine and the stop caches. */
function invalidateDatabaseCaches(): void {
    invalidateNativeRouter();
    invalidateStopCache();
    invalidateStopColors();
}

/**
 * Repoints the app at the database that was active last session. Call it once at startup, before anything touches the db.
 * If that file is missing, no database is active and activeId is cleared, so the list doesn't show a dead selection.
 */
export async function restoreActiveDatabase(): Promise<void> {
    const reg = await readRegistry();
    if (!reg.activeId) return;

    const entry = reg.databases.find(d => d.id === reg.activeId);
    const path = entry ? dbPathFor(entry) : null;
    const exists = path ? (await FileSystem.getInfoAsync(path)).exists : false;

    if (entry && exists) {
        setActiveDbPath(path!);
        return;
    }

    console.warn(`[gtfsDbRegistry] active database "${reg.activeId}" is missing on disk — clearing selection`);
    reg.activeId = null;
    await writeRegistry(reg);
}

/** Points the app (op-sqlite connection and Rust engine) at `id`. Throws if `id` is unknown. */
export async function setActiveDatabase(id: string): Promise<void> {
    const reg = await readRegistry();
    const entry = reg.databases.find(d => d.id === id);
    if (!entry) throw new Error(`Unknown GTFS database id: ${id}`);

    setActiveDbPath(dbPathFor(entry));
    invalidateDatabaseCaches();

    reg.activeId = id;
    await writeRegistry(reg);
    await ensureActiveStats();
}

/** Registers a database file the caller already wrote to disk and makes it active. A colliding name gets a " (1)" suffix. */
export async function registerDatabase(
    name: string,
    fileName: string,
    zipHash?: string,
    source?: FeedSource,
): Promise<GtfsDatabaseEntry> {
    const reg = await readRegistry();
    const uniqueName = dedupeName(name, reg.databases.map(d => d.name));
    const entry: GtfsDatabaseEntry = {
        id: `${Date.now()}`,
        name: uniqueName,
        fileName,
        importedAt: Date.now(),
        zipHash,
        source,
    };
    reg.databases.push(entry);
    reg.activeId = entry.id;
    await writeRegistry(reg);

    setActiveDbPath(dbPathFor(entry));
    invalidateDatabaseCaches();

    return entry;
}

/** Renames an entry. Unlike an import, a collision throws DuplicateNameError, since a rename is deliberate. Keeping the same name is allowed. */
export async function renameDatabase(id: string, newName: string): Promise<void> {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Name cannot be empty.');

    const reg = await readRegistry();
    const entry = reg.databases.find(d => d.id === id);
    if (!entry) throw new Error(`Unknown GTFS database id: ${id}`);

    const collision = reg.databases.some(d => d.id !== id && namesCollide(d.name, trimmed));
    if (collision) throw new DuplicateNameError(trimmed);

    entry.name = trimmed;
    await writeRegistry(reg);
}

export async function getActiveDatabaseEntry(): Promise<GtfsDatabaseEntry | null> {
    const reg = await readRegistry();
    return reg.databases.find(d => d.id === reg.activeId) ?? null;
}

/** Writes only when the flag changes. */
export async function setRealtimeMismatch(id: string, mismatch: boolean): Promise<void> {
    const reg = await readRegistry();
    const entry = reg.databases.find(d => d.id === id);
    if (!entry || !!entry.realtimeMismatch === mismatch) return;
    entry.realtimeMismatch = mismatch || undefined;
    await writeRegistry(reg);
}

/** Empty values clear the setting. */
export async function setRealtimeConfig(id: string, urls: string[], header: string, vehicleUrls: string[]): Promise<void> {
    const reg = await readRegistry();
    const entry = reg.databases.find(d => d.id === id);
    if (!entry) throw new Error(`Unknown GTFS database id: ${id}`);
    const cleaned = urls.map(u => u.trim()).filter(Boolean);
    entry.realtimeUrls = cleaned.length > 0 ? cleaned : undefined;
    const cleanedVehicles = vehicleUrls.map(u => u.trim()).filter(Boolean);
    entry.vehicleUrls = cleanedVehicles.length > 0 ? cleanedVehicles : undefined;
    entry.realtimeHeader = header.trim() || undefined;
    await writeRegistry(reg);
}

export async function setRealtimeAuthHint(id: string, auth: RealtimeAuth | undefined): Promise<void> {
    const reg = await readRegistry();
    const entry = reg.databases.find(d => d.id === id);
    if (!entry) throw new Error(`Unknown GTFS database id: ${id}`);
    entry.realtimeAuth = auth;
    await writeRegistry(reg);
}

/**
 * Removes an entry and its file. If it was active, falls back to the most recently imported one, or to none.
 * Confirming the delete is the settings screen's job.
 */
export async function deleteDatabase(id: string): Promise<void> {
    const reg = await readRegistry();
    const entry = reg.databases.find(d => d.id === id);
    reg.databases = reg.databases.filter(d => d.id !== id);

    if (reg.activeId === id) {
        const fallback = [...reg.databases].sort((a, b) => b.importedAt - a.importedAt)[0] ?? null;
        if (fallback) {
            reg.activeId = fallback.id;
            setActiveDbPath(dbPathFor(fallback));
            invalidateDatabaseCaches();
        } else {
            reg.activeId = null;
            clearActiveDbPath();
            invalidateDatabaseCaches();
        }
    }

    await writeRegistry(reg);

    if (entry) {
        await FileSystem.deleteAsync(dbPathFor(entry), { idempotent: true }).catch(() => {});
    }
}

export async function saveFeedStats(id: string, stats: FeedStats): Promise<void> {
    const reg = await readRegistry();
    const entry = reg.databases.find(d => d.id === id);
    if (!entry) throw new Error(`Unknown GTFS database id: ${id}`);
    entry.stats = stats;
    await writeRegistry(reg);
}

/** Fills in stats for the active database if it was imported before they were tracked. */
export async function ensureActiveStats(): Promise<void> {
    const reg = await readRegistry();
    const entry = reg.databases.find(d => d.id === reg.activeId);
    if (!entry || entry.stats) return;
    await saveFeedStats(entry.id, await computeFeedStats());
}
