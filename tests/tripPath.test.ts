import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { REAL_INDEXES_SQL, REAL_SCHEMA_SQL } from './realSchema';
import { loadTripPath } from '@/services/gtfs/vehicles/tripPath';
import type { QueryableDb } from '@/services/db/queryableDb';

let db: QueryableDb;

const deg = (n: number) => Math.round(n * 1_000_000);

beforeEach(() => {
    const sqlite = new Database(':memory:');
    sqlite.exec(REAL_SCHEMA_SQL);
    sqlite.exec(REAL_INDEXES_SQL);
    db = {
        getAllAsync: async <T>(sql: string, params: any[] = []) => sqlite.prepare(sql).all(...params) as T[],
        execAsync: async (sql: string) => { sqlite.exec(sql); },
        runAsync: async () => ({ lastInsertRowId: 0, changes: 0 }),
    };
    // Trip T1 runs pattern 10 over stops A, B, C with a bent shape. Trip T2 is on pattern 20, which has no shape.
    sqlite.exec(`
        INSERT INTO stops (stop_pk, stop_id, stop_name, stop_lat, stop_lon, agency) VALUES
            (1, 'A', 'A', ${deg(-37.80)}, ${deg(144.90)}, 1),
            (2, 'B', 'B', ${deg(-37.81)}, ${deg(144.91)}, 1),
            (3, 'C', 'C', ${deg(-37.82)}, ${deg(144.90)}, 1);
        INSERT INTO patterns (pattern_pk, route_id, agency, direction_id, shape_id, trip_pk) VALUES
            (10, 'R', 1, 0, 'SH', 100),
            (20, 'R', 1, 0, NULL, 200);
        INSERT INTO trips (trip_pk, trip_id, agency, pattern_pk, service_id) VALUES (100, 'T1', 1, 10, 'WK'), (200, 'T2', 1, 20, 'WK');
        INSERT INTO pattern_stops (pattern_pk, stop_pk, stop_sequence) VALUES
            (10, 3, 30), (10, 1, 10), (10, 2, 20),
            (20, 1, 1), (20, 2, 2);
        INSERT INTO shape_meta (shape_pk, shape_id, agency) VALUES (5, 'SH', 1);
        INSERT INTO shapes (shape_pk, shape_pt_lat, shape_pt_lon, shape_pt_sequence) VALUES
            (5, ${deg(-37.82)}, ${deg(144.90)}, 3),
            (5, ${deg(-37.80)}, ${deg(144.90)}, 1),
            (5, ${deg(-37.81)}, ${deg(144.92)}, 2);
    `);
});

test('a trip is found by its key or by its feed id, with the shape and stops in order', async () => {
    const byPk = await loadTripPath(db, { tripPk: 100 });
    const byId = await loadTripPath(db, { tripId: 'T1' });
    assert.deepEqual(byPk, byId);
    assert.equal(byPk?.tripId, 'T1');
    assert.deepEqual(byPk?.line, [
        { latitude: -37.80, longitude: 144.90 },
        { latitude: -37.81, longitude: 144.92 },
        { latitude: -37.82, longitude: 144.90 },
    ]);
    assert.deepEqual(byPk?.stops.map(s => s.latitude), [-37.80, -37.81, -37.82]);
});

test('without a shape the line runs straight between the stops', async () => {
    const path = await loadTripPath(db, { tripPk: 200 });
    assert.deepEqual(path?.line, path?.stops);
    assert.equal(path?.stops.length, 2);
});

test('a trip the timetable does not know gives no path', async () => {
    assert.equal(await loadTripPath(db, { tripPk: 999 }), null);
    assert.equal(await loadTripPath(db, { tripId: 'nope' }), null);
});
