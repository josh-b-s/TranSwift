import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { REAL_INDEXES_SQL, REAL_SCHEMA_SQL } from './realSchema';
import { scheduledArrivalMs } from '@/services/trips/scheduledArrival';
import { serviceDayStartMs } from '@/services/gtfs/departures/stopDepartures';
import type { QueryableDb } from '@/services/db/queryableDb';

let sqlite: Database.Database;
let db: QueryableDb;

const today = new Date(2026, 9, 29);
const todayStart = serviceDayStartMs(today);

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
    sqlite.exec(`
        INSERT INTO stops (stop_pk, stop_id, stop_name, stop_lat, stop_lon, agency) VALUES
            (1, 'A', 'Alpha', 0, 0, 1), (2, 'B', 'Bravo', 0, 0, 1);
        INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_color, route_text_color, agency)
            VALUES ('R1', '96', 'Long', 0, 'FF0000', 'FFFFFF', 1);
        INSERT INTO patterns (pattern_pk, route_id, agency, direction_id, shape_id, trip_pk) VALUES (10, 'R1', 1, 0, NULL, 100);
        INSERT INTO pattern_stops (pattern_pk, stop_pk, stop_sequence) VALUES (10, 1, 1), (10, 2, 2);
        INSERT INTO trips (trip_pk, trip_id, agency, pattern_pk, service_id) VALUES (100, 'T100', 1, 10, 'WK');
    `);
});

const addTimes = (departAlpha: number, arriveBravo: number) =>
    sqlite.exec(`INSERT INTO stop_times (trip_pk, stop_sequence, stop_pk, arrival_sec, departure_sec) VALUES
        (100, 1, 1, ${departAlpha}, ${departAlpha}), (100, 2, 2, ${arriveBravo}, ${arriveBravo})`);

test('finds the scheduled arrival at the last stop for the planned time', async () => {
    addTimes(10 * 3600, 10 * 3600 + 300);
    const planned = todayStart + (10 * 3600 + 420) * 1000; // planned with a delay on top of the schedule
    const found = await scheduledArrivalMs(db, 100, 2, planned, new Date(2026, 9, 29, 10, 5));
    assert.equal(found, todayStart + (10 * 3600 + 300) * 1000);
});

test('finds a trip that belongs to yesterday service day when it runs past midnight', async () => {
    addTimes(24 * 3600 + 600, 24 * 3600 + 900); // 00:10 to 00:15 the next morning, on yesterday's timetable
    const planned = todayStart + 15 * 60 * 1000;
    const found = await scheduledArrivalMs(db, 100, 2, planned, new Date(2026, 9, 29, 0, 12));
    assert.equal(found, todayStart + 15 * 60 * 1000);
});

test('is null for a trip or stop sequence the timetable does not have', async () => {
    addTimes(10 * 3600, 10 * 3600 + 300);
    const planned = todayStart + (10 * 3600 + 300) * 1000;
    const now = new Date(2026, 9, 29, 10, 5);
    assert.equal(await scheduledArrivalMs(db, 999, 2, planned, now), null);
    assert.equal(await scheduledArrivalMs(db, 100, 7, planned, now), null);
});

test('is null when the trip is nowhere near the planned time', async () => {
    addTimes(6 * 3600, 6 * 3600 + 300);
    const planned = todayStart + (10 * 3600) * 1000;
    assert.equal(await scheduledArrivalMs(db, 100, 2, planned, new Date(2026, 9, 29, 10, 0)), null);
});
