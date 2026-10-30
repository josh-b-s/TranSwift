import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { REAL_INDEXES_SQL, REAL_SCHEMA_SQL } from './realSchema';
import { addedToLiveDepartures } from '@/services/gtfs/departures/addedDepartures';
import { hasLiveData, withAdded } from '@/services/gtfs/departures/liveDepartures';
import type { QueryableDb } from '@/services/db/queryableDb';

const NOW = new Date(2026, 9, 29, 10, 0, 0).getTime();
const MIN = 60_000;

let db: QueryableDb;

beforeEach(() => {
    const sqlite = new Database(':memory:');
    sqlite.exec(REAL_SCHEMA_SQL);
    sqlite.exec(REAL_INDEXES_SQL);
    sqlite.exec(`
        INSERT INTO stops (stop_pk, stop_id, stop_name, stop_lat, stop_lon, agency) VALUES
            (1, 'A', 'Alpha', 0, 0, 1), (2, 'B', 'Bravo', 0, 0, 1);
        INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_color, route_text_color, agency)
            VALUES ('R1', '96', 'Long name', 0, 'FF0000', 'FFFFFF', 1);
    `);
    db = {
        getAllAsync: async <T>(sql: string, params: any[] = []) => sqlite.prepare(sql).all(...params) as T[],
        execAsync: async (sql: string) => { sqlite.exec(sql); },
        runAsync: async (sql: string, params: any[] = []) => {
            const r = sqlite.prepare(sql).run(...params);
            return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes };
        },
    };
});

test('names the route and direction from the timetable', async () => {
    const [d] = await addedToLiveDepartures(db, [{ routeId: 'R1', agency: 1, timeMs: NOW + 5 * MIN, lastStopPk: 2 }], NOW);
    assert.equal(d.routeName, '96');
    assert.equal(d.routeType, 0);
    assert.equal(d.routeColor.toLowerCase(), '#ff0000');
    assert.equal(d.terminus, 'Bravo');
    assert.equal(d.liveTimeMs, NOW + 5 * MIN);
    assert.equal(d.added, true);
});

test('a trip with an unknown route still gets a row with a plain badge', async () => {
    const out = await addedToLiveDepartures(db, [
        { routeId: null, agency: 1, timeMs: NOW + MIN, lastStopPk: 2 },
        { routeId: 'nope', agency: 1, timeMs: NOW + 2 * MIN, lastStopPk: 99 },
    ], NOW);
    assert.deepEqual(out.map(d => [d.routeName, d.terminus]), [['?', 'Bravo'], ['?', '']]);
});

test('leaves out trips already gone and gives each row its own negative trip number', async () => {
    const out = await addedToLiveDepartures(db, [
        { routeId: 'R1', agency: 1, timeMs: NOW - MIN, lastStopPk: 2 },
        { routeId: 'R1', agency: 1, timeMs: NOW + MIN, lastStopPk: 2 },
        { routeId: 'R1', agency: 1, timeMs: NOW + 2 * MIN, lastStopPk: 2 },
    ], NOW);
    assert.equal(out.length, 2);
    assert.deepEqual(out.map(d => d.tripPk), [-1, -2]);
});

test('added trips merge with scheduled ones in order of time, and count as live data', async () => {
    const added = await addedToLiveDepartures(db, [{ routeId: 'R1', agency: 1, timeMs: NOW + 2 * MIN, lastStopPk: 2 }], NOW);
    const scheduled = [{ ...added[0], tripPk: 7, added: undefined, liveTimeMs: NOW + MIN }, { ...added[0], tripPk: 8, added: undefined, liveTimeMs: NOW + 3 * MIN }];
    const merged = withAdded(scheduled, added);
    assert.deepEqual(merged.map(d => d.tripPk), [7, -1, 8]);
    assert.equal(hasLiveData(added), true);
    assert.equal(hasLiveData(scheduled), false);
});
