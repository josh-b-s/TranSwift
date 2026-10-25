import {type DB as OPSQLiteDB, open} from '@op-engineering/op-sqlite';
import * as FileSystem from 'expo-file-system/legacy';

// The database file op-sqlite and the Rust engine use. null means none is selected.
// There is no default file on purpose: querying a stale default after a restart was a past
// bug, so getDb() fails loudly instead.
let currentDbPath: string | null = null;

export function getCurrentDbPath(): string | null {
    return currentDbPath;
}

/**
 * Points getDb() at another file and drops the open connection.
 * Callers also reset the router engine and stop caches, see gtfsDbRegistry.ts.
 */
export function setActiveDbPath(path: string): void {
    if (path === currentDbPath) return;
    currentDbPath = path;
    dbPromise = null;
}

/** Back to "nothing selected". A separate function because setActiveDbPath ignores unchanged paths. */
export function clearActiveDbPath(): void {
    currentDbPath = null;
    dbPromise = null;
}

export async function isDbReady(): Promise<boolean> {
    if (!currentDbPath) return false;
    const {exists} = await FileSystem.getInfoAsync(currentDbPath);
    return exists;
}

/** op-sqlite behind the expo-sqlite style calls the rest of the app uses. */
export class SQLiteDatabase {
    private raw: OPSQLiteDB;

    constructor(raw: OPSQLiteDB) {
        this.raw = raw;
    }

    async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
        const {rows} = await this.raw.execute(sql, params);
        return (rows ?? []) as unknown as T[];
    }

    /** Runs each statement in turn, because op-sqlite's execute() only runs the first one. */
    async execAsync(sql: string): Promise<void> {
        const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
        for (const stmt of statements) {
            await this.raw.execute(stmt);
        }
    }

    async runAsync(sql: string, params: any[] = []): Promise<{ lastInsertRowId: number; changes: number }> {
        const res = await this.raw.execute(sql, params);
        return {lastInsertRowId: res.insertId ?? 0, changes: res.rowsAffected ?? 0};
    }
}

let dbPromise: Promise<SQLiteDatabase> | null = null;

/** The shared connection. Concurrent callers share one open, since op-sqlite wants one connection per file. */
export function getDb(): Promise<SQLiteDatabase> {
    if (!dbPromise) {
        const opening = openDb();
        dbPromise = opening;
        // A failed open is not cached, so a later call can retry once the file exists.
        opening.catch(() => {
            if (dbPromise === opening) dbPromise = null;
        });
    }
    return dbPromise;
}

async function openDb(): Promise<SQLiteDatabase> {
    if (!currentDbPath) {
        throw new Error('No GTFS database selected. Import or pick one in Settings → GTFS data.');
    }
    if (!(await isDbReady())) {
        throw new Error('GTFS database not found. Download it first.');
    }

    const lastSlash = currentDbPath.lastIndexOf('/');
    const name = currentDbPath.slice(lastSlash + 1);
    const location = currentDbPath.slice(0, lastSlash + 1);
    const db = new SQLiteDatabase(open({name, location}));

    await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA cache_size   = -8000;
        PRAGMA temp_store   = MEMORY;
        PRAGMA mmap_size    = 268435456;
    `);
    return db;
}

export type LatLng = { latitude: number; longitude: number };
