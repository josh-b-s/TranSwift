import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { REAL_INDEXES_SQL, REAL_SCHEMA_SQL } from './realSchema';
import { addStopCalls, call } from './timetableFixtures';
import { vehicleDeparture } from '@/services/gtfs/vehicles/vehicleDeparture';
import { getTripStops } from '@/services/gtfs/departures/tripStops';
import type { QueryableDb } from '@/services/db/queryableDb';

let db: QueryableDb;

const vehicle = (currentStopSequence: number | null, tripId = 'T1') =>
    ({ tripId, currentStopSequence, routeName: '86', routeType: 0, color: '#000', textColor: '#fff' });
const at = (h: number, m = 0) => new Date(2026, 10, 9, h, m, 0, 0);

beforeEach(() => {
    const sqlite = new Database(':memory:');
    sqlite.exec(REAL_SCHEMA_SQL);
    sqlite.exec(REAL_INDEXES_SQL);
    db = {
        getAllAsync: async <T>(sql: string, params: any[] = []) => sqlite.prepare(sql).all(...params) as T[],
        execAsync: async (sql: string) => { sqlite.exec(sql); },
        runAsync: async () => ({ lastInsertRowId: 0, changes: 0 }),
    };
    sqlite.exec(`
        INSERT INTO stops (stop_pk, stop_id, stop_name, stop_lat, stop_lon, agency) VALUES
            (1, 'A', 'Alpha', 0, 0, 1), (2, 'B', 'Bravo', 0, 0, 1), (3, 'C', 'Charlie', 0, 0, 1), (4, 'D', 'Delta', 0, 0, 1);
        INSERT INTO patterns (pattern_pk, route_id, agency, direction_id, shape_id, trip_pk) VALUES (10, 'R', 1, 0, NULL, 1), (20, 'R', 1, 0, NULL, 2);
        INSERT INTO trips (trip_pk, trip_id, agency, pattern_pk, service_id) VALUES (1, 'T1', 1, 10, 'WK'), (2, 'T2', 1, 20, 'WK');
        INSERT INTO pattern_stops (pattern_pk, stop_pk, stop_sequence) VALUES
            (10, 1, 1), (10, 2, 2), (10, 3, 3), (10, 4, 4), (20, 1, 1), (20, 2, 2), (20, 3, 3);
    `);
    // A stop's calls are stored by stop. T1 calls at 08:00, 08:10, 08:20 and 08:30. T2 runs past midnight: 23:50, 24:00, 24:10.
    addStopCalls(sqlite, 1, [call(28800, 1, 1), call(86400 - 600, 2, 1)]);
    addStopCalls(sqlite, 2, [call(29400, 1, 2), call(86400, 2, 2)]);
    addStopCalls(sqlite, 3, [call(30000, 1, 3), call(86400 + 600, 2, 3)]);
    addStopCalls(sqlite, 4, [call(30600, 1, 4)]);
});

test('lists the stops from the one the vehicle is heading to', async () => {
    const departure = await vehicleDeparture(db, vehicle(3), 'Delta', at(8, 12));
    assert.ok(departure);
    const stops = await getTripStops(db, departure);
    assert.deepEqual(stops.map(s => s.stopName), ['Charlie', 'Delta']);
});

test('with no stop reported it goes by the clock', async () => {
    const departure = await vehicleDeparture(db, vehicle(null), null, at(8, 13));
    const stops = await getTripStops(db, departure!);
    assert.deepEqual(stops.map(s => s.stopName), ['Charlie', 'Delta']);
});

test('a vehicle running late still gets the stop it is heading to', async () => {
    const departure = await vehicleDeparture(db, vehicle(2), 'Delta', at(8, 40));
    const stops = await getTripStops(db, departure!);
    assert.equal(stops[0].stopName, 'Bravo');
});

test('a trip running past midnight is found on the day before', async () => {
    const departure = await vehicleDeparture(db, vehicle(2, 'T2'), null, new Date(2026, 10, 10, 0, 3));
    assert.ok(departure);
    assert.equal(departure.dayStartMs, new Date(2026, 10, 9).getTime());
});

test('a trip the timetable does not know, or one with no id, gives nothing', async () => {
    assert.equal(await vehicleDeparture(db, vehicle(1, 'nope'), null, at(8)), null);
    assert.equal(await vehicleDeparture(db, vehicle(1, null as unknown as string), null, at(8)), null);
});
