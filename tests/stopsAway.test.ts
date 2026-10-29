import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { REAL_INDEXES_SQL, REAL_SCHEMA_SQL } from './realSchema';
import { loadStopsAway } from '@/services/gtfs/departures/stopsAway';
import type { VehicleFix } from '@/services/gtfs/vehicles/vehicleFix';
import type { QueryableDb } from '@/services/db/queryableDb';

let sqlite: Database.Database;
let db: QueryableDb;

const fix = (tripId: string | null, currentStopSequence: number | null): VehicleFix => ({
    key: `${tripId}`, label: null, tripId, routeId: null, latitude: -37.8, longitude: 144.9,
    bearing: null, speedMps: null, timestampSec: null, currentStopSequence,
});

beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.exec(REAL_SCHEMA_SQL);
    sqlite.exec(REAL_INDEXES_SQL);
    db = {
        getAllAsync: async <T>(sql: string, params: any[] = []) => sqlite.prepare(sql).all(...params) as T[],
        execAsync: async (sql: string) => { sqlite.exec(sql); },
        runAsync: async (sql: string, params: any[] = []) => {
            const r = sqlite.prepare(sql).run(...params);
            return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes };
        },
    };
    // Pattern 10 calls at five stops numbered 1, 2, 3, 5, 8: sequences need not be consecutive.
    sqlite.exec(`
        INSERT INTO stops (stop_pk, stop_id, stop_name, stop_lat, stop_lon, agency) VALUES
            (1, 'A', 'A', 0, 0, 1), (2, 'B', 'B', 0, 0, 1), (3, 'C', 'C', 0, 0, 1), (4, 'D', 'D', 0, 0, 1), (5, 'E', 'E', 0, 0, 1);
        INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_color, route_text_color, agency)
            VALUES ('R1', '96', 'Long', 0, '#FF0000', '#FFFFFF', 1);
        INSERT INTO patterns (pattern_pk, route_id, agency, direction_id, shape_id, trip_pk) VALUES (10, 'R1', 1, 0, NULL, 100);
        INSERT INTO pattern_stops (pattern_pk, stop_pk, stop_sequence) VALUES (10, 1, 1), (10, 2, 2), (10, 3, 3), (10, 4, 5), (10, 5, 8);
        INSERT INTO trips (trip_pk, trip_id, agency, pattern_pk, service_id) VALUES (100, 'T100', 1, 10, 'WK'), (101, 'T101', 1, 10, 'WK');
    `);
});

test('counts the pattern stops between the vehicle and the departure stop', async () => {
    // At sequence 2, heading for the stop numbered 8: stops 2, 3 and 5 come first.
    const out = await loadStopsAway(db, [{ tripPk: 100, stopSequence: 8 }], [fix('T100', 2)]);
    assert.deepEqual([...out], [[100, 3]]);
});

test('zero when the stop is the vehicle current or next one', async () => {
    const out = await loadStopsAway(db, [{ tripPk: 100, stopSequence: 5 }], [fix('T100', 5)]);
    assert.deepEqual([...out], [[100, 0]]);
});

test('leaves out vehicles that have passed the stop, or report no trip or stop sequence', async () => {
    const out = await loadStopsAway(
        db,
        [{ tripPk: 100, stopSequence: 3 }, { tripPk: 101, stopSequence: 3 }],
        [fix('T100', 5), fix(null, 1), fix('T101', null), fix('unknown', 1)],
    );
    assert.equal(out.size, 0);
});

test('each trip is matched to its own vehicle', async () => {
    const out = await loadStopsAway(
        db,
        [{ tripPk: 100, stopSequence: 8 }, { tripPk: 101, stopSequence: 8 }],
        [fix('T100', 5), fix('T101', 1)],
    );
    assert.deepEqual([...out].sort(), [[100, 1], [101, 4]]);
});

test('a trip that calls twice at the stop counts to the first call', async () => {
    const out = await loadStopsAway(db, [{ tripPk: 100, stopSequence: 3 }, { tripPk: 100, stopSequence: 8 }], [fix('T100', 1)]);
    assert.deepEqual([...out], [[100, 2]]);
});
