import type { QueryableDb } from '@/services/db/queryableDb';

const known = new WeakMap<QueryableDb, boolean>();

/**
 * Whether this database stores trip headsigns. Databases imported before the column existed do not, and keep
 * showing the trip's last stop until the feed is imported again. Looked up once per connection.
 */
export async function hasTripHeadsign(db: QueryableDb): Promise<boolean> {
    const cached = known.get(db);
    if (cached !== undefined) return cached;
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(trips)');
    const found = columns.some(c => c.name === 'trip_headsign');
    known.set(db, found);
    return found;
}

/** The SQL for a trip's headsign, with blanks as NULL, or NULL itself for a database that has no headsigns. For a query over `trips t`. */
export async function headsignSql(db: QueryableDb): Promise<string> {
    return (await hasTripHeadsign(db)) ? "NULLIF(TRIM(t.trip_headsign), '')" : 'NULL';
}
