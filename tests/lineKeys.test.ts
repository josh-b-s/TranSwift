import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { REAL_INDEXES_SQL, REAL_SCHEMA_SQL } from './realSchema';
import { loadLineKeys } from '@/services/gtfs/vehicles/lineKeys';
import type { QueryableDb } from '@/services/db/queryableDb';

let db: QueryableDb;

beforeEach(() => {
    const sqlite = new Database(':memory:');
    sqlite.exec(REAL_SCHEMA_SQL);
    sqlite.exec(REAL_INDEXES_SQL);
    db = {
        getAllAsync: async <T>(sql: string, params: any[] = []) => sqlite.prepare(sql).all(...params) as T[],
        execAsync: async (sql: string) => { sqlite.exec(sql); },
        runAsync: async () => ({ lastInsertRowId: 0, changes: 0 }),
    };
    // Route R runs A to C (pattern 10, trips T1 and T2), C to A (pattern 11, trip T3) and A to B (pattern 12, trip T4).
    sqlite.exec(`
        INSERT INTO stops (stop_pk, stop_id, stop_name, stop_lat, stop_lon, agency) VALUES
            (1, 'A', 'Alpha', 0, 0, 1), (2, 'B', 'Bravo', 0, 0, 1), (3, 'C', 'Charlie', 0, 0, 1);
        INSERT INTO patterns (pattern_pk, route_id, agency, direction_id, shape_id, trip_pk) VALUES
            (10, 'R', 1, 0, NULL, 1), (11, 'R', 1, 1, NULL, 3), (12, 'R', 1, 0, NULL, 4);
        INSERT INTO trips (trip_pk, trip_id, agency, pattern_pk, service_id) VALUES
            (1, 'T1', 1, 10, 'WK'), (2, 'T2', 1, 10, 'WK'), (3, 'T3', 1, 11, 'WK'), (4, 'T4', 1, 12, 'WK');
        INSERT INTO pattern_stops (pattern_pk, stop_pk, stop_sequence) VALUES
            (10, 1, 1), (10, 2, 2), (10, 3, 3),
            (11, 3, 1), (11, 2, 2), (11, 1, 3),
            (12, 1, 1), (12, 2, 2);
    `);
});

test('trips of a route that end at the same stop share a key, and other ends or directions do not', async () => {
    const keys = await loadLineKeys(db, ['T1', 'T2', 'T3', 'T4']);
    assert.equal(keys.get('T1'), keys.get('T2'));
    assert.notEqual(keys.get('T1'), keys.get('T3'));
    assert.notEqual(keys.get('T1'), keys.get('T4'));
});

test('a trip the timetable does not know is left out', async () => {
    const keys = await loadLineKeys(db, ['T1', 'nope']);
    assert.deepEqual([...keys.keys()], ['T1']);
});
