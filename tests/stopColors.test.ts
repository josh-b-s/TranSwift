import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { REAL_INDEXES_SQL, REAL_SCHEMA_SQL } from './realSchema';
import { cachedStopColors, invalidateStopColors, loadStopColors } from '@/services/gtfs/departures/stopColors';
import type { QueryableDb } from '@/services/db/queryableDb';

let sqlite: Database.Database;
let db: QueryableDb;
let queries: number;

beforeEach(() => {
    invalidateStopColors();
    queries = 0;
    sqlite = new Database(':memory:');
    sqlite.exec(REAL_SCHEMA_SQL);
    sqlite.exec(REAL_INDEXES_SQL);
    db = {
        getAllAsync: async <T>(sql: string, params: any[] = []) => { queries++; return sqlite.prepare(sql).all(...params) as T[]; },
        execAsync: async (sql: string) => { sqlite.exec(sql); },
        runAsync: async () => ({ lastInsertRowId: 0, changes: 0 }),
    };
    // Stop 1 is served by route R1 (one pattern, red) and R2 (two patterns, no colour, a bus). Stop 2 only by R1. Stop 3 by nothing.
    sqlite.exec(`
        INSERT INTO stops (stop_pk, stop_id, stop_name, stop_lat, stop_lon, agency) VALUES
            (1, 'A', 'Alpha', 0, 0, 1), (2, 'B', 'Bravo', 0, 0, 1), (3, 'C', 'Charlie', 0, 0, 1);
        INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_color, route_text_color, agency) VALUES
            ('R1', '96', 'One', 0, 'FF0000', 'FFFFFF', 1), ('R2', '200', 'Two', 3, NULL, NULL, 1);
        INSERT INTO patterns (pattern_pk, route_id, agency, direction_id, shape_id, trip_pk) VALUES
            (10, 'R1', 1, 0, NULL, 0), (20, 'R2', 1, 0, NULL, 0), (21, 'R2', 1, 1, NULL, 0);
        INSERT INTO pattern_stops (pattern_pk, stop_pk, stop_sequence) VALUES
            (10, 1, 1), (10, 2, 2), (20, 1, 1), (21, 1, 1);
    `);
});

test('picks the route with the most patterns at the stop, using its colour or the mode fallback', async () => {
    await loadStopColors(db, [1, 2]);
    const colors = cachedStopColors([1, 2]);
    assert.equal(colors.get(1), '#F97316');
    assert.equal(colors.get(2), '#FF0000');
});

test('leaves out stops that no route serves', async () => {
    await loadStopColors(db, [3]);
    assert.equal(cachedStopColors([3]).has(3), false);
});

test('only asks the database about stops it has not seen', async () => {
    await loadStopColors(db, [1, 3]);
    assert.equal(queries, 1);
    await loadStopColors(db, [1, 3]);
    assert.equal(queries, 1);
    await loadStopColors(db, [1, 2, 3]);
    assert.equal(queries, 2);
});
