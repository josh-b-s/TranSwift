import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { REAL_INDEXES_SQL, REAL_SCHEMA_SQL } from './realSchema';
import { getStopDepartures } from '@/services/gtfs/departures/stopDepartures';
import type { QueryableDb } from '@/services/db/queryableDb';

const HOUR_MS = 3_600_000;
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();
// Oct 26 2026 is a Monday.
const MON = 26;
const TUE = 27;

let sqlite: Database.Database;
let db: QueryableDb;

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

    // One line "96" from Alpha (1) to Bravo (2) to Charlie (3), running Monday to Friday.
    sqlite.exec(`
        INSERT INTO stops (stop_pk, stop_id, stop_name, stop_lat, stop_lon, agency) VALUES
            (1, 'A', 'Alpha', 0, 0, 1), (2, 'B', 'Bravo', 0, 0, 1), (3, 'C', 'Charlie', 0, 0, 1);
        INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_color, route_text_color, agency)
            VALUES ('R1', '96', 'Long name', 0, '#FF0000', '#FFFFFF', 1);
        INSERT INTO patterns (pattern_pk, route_id, agency, direction_id, shape_id, trip_pk) VALUES (10, 'R1', 1, 0, NULL, 100);
        INSERT INTO pattern_stops (pattern_pk, stop_pk, stop_sequence) VALUES (10, 1, 1), (10, 2, 2), (10, 3, 3);
        INSERT INTO calendar (service_id, agency, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date)
            VALUES ('WK', 1, 1, 1, 1, 1, 1, 0, 0, '20260101', '20261231');
    `);
});

/** A trip of pattern 10 whose departure from Alpha is `fromAlphaSec`, with 5 minutes between stops. */
function addTrip(tripPk: number, serviceId: string, fromAlphaSec: number) {
    sqlite.prepare(`INSERT INTO trips (trip_pk, trip_id, agency, pattern_pk, service_id) VALUES (?, ?, 1, 10, ?)`)
        .run(tripPk, `t${tripPk}`, serviceId);
    [1, 2, 3].forEach((stopPk, i) => {
        const sec = fromAlphaSec + i * 300;
        sqlite.prepare(`INSERT INTO stop_times (trip_pk, stop_sequence, stop_pk, arrival_sec, departure_sec) VALUES (?, ?, ?, ?, ?)`)
            .run(tripPk, i + 1, stopPk, sec, sec);
    });
}

test('lists departures soonest first, with line, colour and last stop', async () => {
    addTrip(101, 'WK', 11 * 3600);
    addTrip(100, 'WK', 10 * 3600);
    const out = await getStopDepartures(db, 1, new Date(at(MON, 9, 30)), 3 * HOUR_MS, 10);
    assert.deepEqual(out.map(d => d.timeMs), [at(MON, 10), at(MON, 11)]);
    assert.equal(out[0].routeName, '96');
    assert.equal(out[0].routeColor, '#FF0000');
    assert.equal(out[0].terminus, 'Charlie');
});

test('leaves out departures outside the window', async () => {
    addTrip(100, 'WK', 10 * 3600);
    addTrip(101, 'WK', 11 * 3600);
    const out = await getStopDepartures(db, 1, new Date(at(MON, 10, 30)), HOUR_MS, 10);
    assert.deepEqual(out.map(d => d.timeMs), [at(MON, 11)]);
});

test('trips ending at the stop are not departures', async () => {
    addTrip(100, 'WK', 10 * 3600);
    assert.deepEqual(await getStopDepartures(db, 3, new Date(at(MON, 9)), 3 * HOUR_MS, 10), []);
    assert.equal((await getStopDepartures(db, 2, new Date(at(MON, 9)), 3 * HOUR_MS, 10)).length, 1);
});

test('ignores services that do not run that day', async () => {
    addTrip(100, 'WK', 10 * 3600);
    sqlite.exec(`UPDATE calendar SET monday = 0`);
    assert.deepEqual(await getStopDepartures(db, 1, new Date(at(MON, 9)), 3 * HOUR_MS, 10), []);
});

test('calendar exceptions remove and add service', async () => {
    addTrip(100, 'WK', 10 * 3600);
    addTrip(101, 'SPECIAL', 11 * 3600);
    sqlite.exec(`
        INSERT INTO calendar_dates (service_id, agency, date, exception_type) VALUES
            ('WK', 1, '20261026', 2), ('SPECIAL', 1, '20261026', 1);
    `);
    const out = await getStopDepartures(db, 1, new Date(at(MON, 9)), 3 * HOUR_MS, 10);
    assert.deepEqual(out.map(d => d.timeMs), [at(MON, 11)]);
});

test('yesterday\'s late trip appears after midnight', async () => {
    addTrip(100, 'WK', 24 * 3600 + 45 * 60); // 24:45 on Monday's service day
    addTrip(101, 'WK', 6 * 3600);            // an ordinary Tuesday trip
    const out = await getStopDepartures(db, 1, new Date(at(TUE, 0, 30)), 2 * HOUR_MS, 10);
    assert.deepEqual(out.map(d => d.timeMs), [at(TUE, 0, 45)]);
});

test('a service id shared with another agency does not leak across', async () => {
    addTrip(100, 'WK', 10 * 3600);
    // Agency 2 also calls its service WK but has no calendar entry, so it does not run.
    sqlite.exec(`
        INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_color, route_text_color, agency)
            VALUES ('R2', '7', 'Other agency', 3, '', '', 2);
        INSERT INTO patterns (pattern_pk, route_id, agency, direction_id, shape_id, trip_pk) VALUES (20, 'R2', 2, 0, NULL, 200);
        INSERT INTO pattern_stops (pattern_pk, stop_pk, stop_sequence) VALUES (20, 1, 1), (20, 3, 2);
        INSERT INTO trips (trip_pk, trip_id, agency, pattern_pk, service_id) VALUES (200, 't200', 2, 20, 'WK');
        INSERT INTO stop_times (trip_pk, stop_sequence, stop_pk, arrival_sec, departure_sec) VALUES
            (200, 1, 1, 36060, 36060), (200, 2, 3, 36360, 36360);
    `);
    const out = await getStopDepartures(db, 1, new Date(at(MON, 9)), 3 * HOUR_MS, 10);
    assert.deepEqual(out.map(d => d.routeName), ['96']);
});

test('respects the limit', async () => {
    for (let i = 0; i < 5; i++) addTrip(100 + i, 'WK', (10 + i) * 3600);
    const out = await getStopDepartures(db, 1, new Date(at(MON, 9)), 8 * HOUR_MS, 2);
    assert.equal(out.length, 2);
});

test('a loop trip departs from its first stop but its return there is not a departure', async () => {
    sqlite.exec(`
        INSERT INTO patterns (pattern_pk, route_id, agency, direction_id, shape_id, trip_pk) VALUES (11, 'R1', 1, 0, NULL, 200);
        INSERT INTO pattern_stops (pattern_pk, stop_pk, stop_sequence) VALUES (11, 1, 1), (11, 2, 2), (11, 1, 3);
        INSERT INTO trips (trip_pk, trip_id, agency, pattern_pk, service_id) VALUES (200, 'loop', 1, 11, 'WK');
        INSERT INTO stop_times (trip_pk, stop_sequence, stop_pk, arrival_sec, departure_sec) VALUES
            (200, 1, 1, 36000, 36000), (200, 2, 2, 36300, 36300), (200, 3, 1, 36600, 36600);
    `);
    const out = await getStopDepartures(db, 1, new Date(at(MON, 9)), 3 * HOUR_MS, 10);
    assert.deepEqual(out.map(d => d.timeMs), [at(MON, 10)]);
});
