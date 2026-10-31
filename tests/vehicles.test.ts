import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { REAL_INDEXES_SQL, REAL_SCHEMA_SQL } from './realSchema';
import { freshVehicles, type VehicleFix } from '@/services/gtfs/vehicles/vehicleFix';
import { attachRoutes, loadRouteLookup, pickVehicles, routeKey, type MapVehicle } from '@/services/gtfs/vehicles/vehicleRoutes';
import type { QueryableDb } from '@/services/db/queryableDb';

const NOW_MS = 1_790_000_000_000;
const NOW_S = NOW_MS / 1000;

const fix = (key: string, over: Partial<VehicleFix> = {}): VehicleFix => ({
    key, label: null, tripId: null, routeId: null, latitude: -37.8, longitude: 144.9, bearing: null, speedMps: null, timestampSec: NOW_S, currentStopSequence: null, ...over,
});

let sqlite: Database.Database;
let db: QueryableDb;

beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.exec(REAL_SCHEMA_SQL);
    sqlite.exec(REAL_INDEXES_SQL);
    db = {
        getAllAsync: async <T>(sql: string, params: any[] = []) => sqlite.prepare(sql).all(...params) as T[],
        execAsync: async (sql: string) => { sqlite.exec(sql); },
        runAsync: async () => ({ lastInsertRowId: 0, changes: 0 }),
    };
    // Tram 96 (type 0, orange-red) and bus 96 (type 3, no colour). Trip T1 runs the tram.
    sqlite.exec(`
        INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_color, route_text_color, agency) VALUES
            ('TRAM96', '96', 'East Brunswick', 0, '#E31837', '#FFFFFF', 1),
            ('BUS96', '96', 'Bus', 3, NULL, NULL, 1),
            ('LONG', '', 'Only a long name', 3, NULL, NULL, 1);
        INSERT INTO patterns (pattern_pk, route_id, agency, direction_id, shape_id, trip_pk) VALUES (10, 'TRAM96', 1, 0, NULL, 100);
        INSERT INTO trips (trip_pk, trip_id, agency, pattern_pk, service_id) VALUES (100, 'T1', 1, 10, 'WK');
    `);
});

test('stale fixes are dropped, the newest of a repeated vehicle wins, and undated ones stay', () => {
    const out = freshVehicles([
        fix('old', { timestampSec: NOW_S - 600 }),
        fix('a', { timestampSec: NOW_S - 60, latitude: 1 }),
        fix('a', { timestampSec: NOW_S - 10, latitude: 2 }),
        fix('a', { timestampSec: NOW_S - 30, latitude: 3 }),
        fix('undated', { timestampSec: null }),
    ], NOW_MS);
    assert.deepEqual(out.map(v => v.key).sort(), ['a', 'undated']);
    assert.equal(out.find(v => v.key === 'a')!.latitude, 2);
});

test('a trip id names its route, and beats a route id that disagrees', async () => {
    const fixes = [fix('v1', { tripId: 'T1', routeId: 'BUS96' }), fix('v2', { routeId: 'BUS96' }), fix('v3', { routeId: 'LONG' })];
    const out = attachRoutes(fixes, await loadRouteLookup(db, fixes));
    assert.deepEqual(out.map(v => [v.key, v.routeType, v.color]), [
        ['v1', 0, '#E31837'],
        ['v2', 3, '#F97316'],  // no colour in the feed: the bus fallback
        ['v3', 3, '#F97316'],
    ]);
    assert.equal(out[2].routeName, 'Only a long name');
});

test('vehicles whose ids the timetable does not know are left out, and so are fixes with no ids', async () => {
    const fixes = [fix('x', { tripId: 'nope', routeId: 'nope' }), fix('y')];
    assert.deepEqual(attachRoutes(fixes, await loadRouteLookup(db, fixes)), []);
});

test('lookups handle more ids than one query takes', async () => {
    const fixes = Array.from({ length: 1200 }, (_, i) => fix(`v${i}`, { routeId: i % 2 === 0 ? 'TRAM96' : 'BUS96', tripId: `none${i}` }));
    const out = attachRoutes(fixes, await loadRouteLookup(db, fixes));
    assert.equal(out.length, 1200);
});

const mapVehicle = (key: string, routeName: string, routeType: number, lat: number, lon = 144.9): MapVehicle => ({
    ...fix(key, { latitude: lat, longitude: lon }), routeName, routeType, color: '#000000', textColor: '#FFFFFF',
});

test('picking keeps wanted routes only, telling same-named routes apart by type', () => {
    const all = [mapVehicle('tram', '96', 0, -37.8), mapVehicle('bus', '96', 3, -37.8), mapVehicle('other', '109', 0, -37.8)];
    assert.deepEqual(pickVehicles(all, new Set([routeKey('96', 0)]), 10).map(v => v.key), ['tram']);
    assert.deepEqual(pickVehicles(all, new Set(), 10), []);
    assert.equal(pickVehicles(all, null, 10).length, all.length);
});

test('picking takes the nearest when over the cap', () => {
    const all = [mapVehicle('far', '96', 0, -38.5), mapVehicle('near', '96', 0, -37.81), mapVehicle('mid', '96', 0, -37.9)];
    const out = pickVehicles(all, new Set([routeKey('96', 0)]), 2, { latitude: -37.8, longitude: 144.9 });
    assert.deepEqual(out.map(v => v.key), ['near', 'mid']);
});

test('bearings snap to 15 degree steps and wrap', async () => {
    const { bearingBucket } = await import('@/services/gtfs/vehicles/vehicleBearing');
    assert.equal(bearingBucket(null), null);
    assert.equal(bearingBucket(92), 90);
    assert.equal(bearingBucket(358), 0);
    assert.equal(bearingBucket(-10), 345);
});

test('short route names fill the badge and longer ones are cut to three letters', async () => {
    const { badgeText } = await import('@/services/gtfs/vehicles/badgeText');
    assert.equal(badgeText('96'), '96');
    assert.equal(badgeText('109X'), '109X');
    assert.equal(badgeText('Frankston'), 'Fra');
    assert.equal(badgeText('Upfield'), 'Upf');
});

test('zoomed out, only the vehicles on the shown trip\'s route and terminus are drawn', async () => {
    const { visibleVehicles } = await import('@/services/gtfs/vehicles/visibleVehicles');
    const all = ['a', 'b', 'c', 'd'].map((key, i) => ({ ...mapVehicle(key, '96', 0, -37.8), tripId: `T${i}` }));
    // T0 and T1 run to the same end, T2 the other way, and the timetable does not know T3.
    const lineKeys = new Map([['T0', '1|R|North'], ['T1', '1|R|North'], ['T2', '1|R|South']]);
    assert.equal(visibleVehicles(all, true, null).length, 4);
    assert.deepEqual(visibleVehicles(all, false, null), []);
    assert.deepEqual(visibleVehicles(all, false, { tripId: 'T0', lineKeys }).map(v => v.key), ['a', 'b']);
    // Its own vehicle stays even before its line is known.
    assert.deepEqual(visibleVehicles(all, false, { tripId: 'T3', lineKeys }).map(v => v.key), ['d']);
});
