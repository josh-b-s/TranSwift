import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { REAL_INDEXES_SQL, REAL_SCHEMA_SQL } from './realSchema';
import { loadStationDetail } from '@/services/gtfs/station/stationQueries';
import { pathTo, shortestPaths, type PathwayEdge } from '@/services/gtfs/station/pathwayGraph';
import { isStepFree, routeSteps } from '@/services/gtfs/station/routeSteps';
import type { QueryableDb } from '@/services/db/queryableDb';

let sqlite: Database.Database;
let db: QueryableDb;

const wrap = (s: Database.Database): QueryableDb => ({
    getAllAsync: async <T>(sql: string, params: any[] = []) => s.prepare(sql).all(...params) as T[],
    execAsync: async (sql: string) => { s.exec(sql); },
    runAsync: async (sql: string, params: any[] = []) => {
        const r = s.prepare(sql).run(...params);
        return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes };
    },
});

const edge = (fromId: string, toId: string, mode: number, over: Partial<PathwayEdge> = {}): PathwayEdge => ({
    fromId, toId, mode, bidirectional: false, lengthM: null, seconds: null, stairCount: null, signpost: null, reverseSignpost: null, ...over,
});

beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.exec(REAL_SCHEMA_SQL);
    sqlite.exec(REAL_INDEXES_SQL);
    db = wrap(sqlite);

    // Central station with platforms 1 and 2 on level L1, a concourse, and two exits. Line 96 runs P1 to P2's far end.
    sqlite.exec(`
        INSERT INTO stops (stop_pk, stop_id, stop_name, stop_lat, stop_lon, agency) VALUES
            (1, 'P1', 'Central Platform 1', 0, 0, 1), (2, 'P2', 'Central Platform 2', 0, 0, 1),
            (3, 'FAR', 'Far End', 0, 0, 1), (4, 'LOOSE', 'Plain Stop', 0, 0, 1), (5, 'P10', 'Central Platform 10', 0, 0, 1);
        INSERT INTO stop_platforms (stop_pk, parent_station, platform_code, level_id) VALUES
            (1, 'ST', '1', 'L1'), (2, 'ST', '2', 'L1'), (5, 'ST', '10', 'L1');
        INSERT INTO station_nodes (node_id, agency, node_name, location_type, parent_station, level_id) VALUES
            ('ST', 1, 'Central Station', 1, NULL, NULL),
            ('GN', 1, 'Concourse', 3, 'ST', 'L0'),
            ('EX1', 1, 'Swanston St exit', 2, 'ST', 'L0'),
            ('EX2', 1, 'Elizabeth St exit', 2, 'ST', 'L0'),
            ('EX3', 1, 'Locked exit', 2, 'ST', 'L0');
        INSERT INTO levels (level_id, agency, level_index, level_name) VALUES ('L0', 1, 0, 'Concourse'), ('L1', 1, -1, 'Platforms');
        INSERT INTO pathways (pathway_id, agency, from_id, to_id, mode, is_bidirectional, length_m, traversal_sec, stair_count, signposted_as, reversed_signposted_as) VALUES
            ('w1', 1, 'P1', 'GN', 4, 0, NULL, 25, NULL, 'Up to concourse', NULL),
            ('w1b', 1, 'GN', 'P1', 4, 0, NULL, 25, NULL, NULL, NULL),
            ('w2', 1, 'GN', 'EX1', 1, 1, 40, 35, NULL, 'Swanston St', 'To platforms'),
            ('w3', 1, 'GN', 'EX2', 1, 1, 80, NULL, NULL, 'Elizabeth St', NULL),
            ('w4', 1, 'P1', 'GN', 5, 1, NULL, 60, 0, 'Lift to concourse', NULL);
        INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_color, route_text_color, agency) VALUES ('R1', '96', 'Long', 0, '#FF0000', '#FFFFFF', 1);
        INSERT INTO patterns (pattern_pk, route_id, agency, direction_id, shape_id, trip_pk) VALUES (10, 'R1', 1, 0, NULL, 100), (11, 'R1', 1, 1, NULL, 101);
        INSERT INTO pattern_stops (pattern_pk, stop_pk, stop_sequence) VALUES (10, 1, 1), (10, 3, 2), (11, 3, 1), (11, 2, 2);
    `);
});

test('an older database without station tables asks for a fresh import', async () => {
    const old = new Database(':memory:');
    old.exec('CREATE TABLE stops (stop_pk INTEGER PRIMARY KEY, stop_id TEXT, stop_name TEXT, stop_lat INTEGER, stop_lon INTEGER, agency INTEGER)');
    assert.deepEqual(await loadStationDetail(wrap(old), 1), { status: 'unavailable' });
});

test('a stop with no station information has no detail', async () => {
    assert.deepEqual(await loadStationDetail(db, 4), { status: 'none' });
    assert.deepEqual(await loadStationDetail(db, 999), { status: 'none' });
});

test('lists the station platforms with the current one first and codes in numeric order', async () => {
    const result = await loadStationDetail(db, 2);
    assert.equal(result.status, 'ok');
    if (result.status !== 'ok') return;
    assert.equal(result.detail.stationName, 'Central Station');
    assert.deepEqual(result.detail.platforms.map(p => [p.platformCode, p.isCurrent]), [['2', true], ['1', false], ['10', false]]);
    assert.equal(result.detail.platforms[1].levelName, 'Platforms');
});

test('says which way each platform heads, leaving out lines that end at the platform', async () => {
    const result = await loadStationDetail(db, 1);
    if (result.status !== 'ok') return assert.fail('expected detail');
    const toward = Object.fromEntries(result.detail.platforms.map(p => [p.platformCode, p.toward]));
    assert.deepEqual(toward['1'], ['96 to Far End']);
    assert.deepEqual(toward['2'], []); // pattern 11 ends at platform 2
    assert.deepEqual(toward['10'], []);
});

test('exits are ranked by the quickest route from this platform, with unreachable ones last', async () => {
    const result = await loadStationDetail(db, 1);
    if (result.status !== 'ok') return assert.fail('expected detail');
    const exits = result.detail.exits;
    assert.deepEqual(exits.map(e => e.name), ['Swanston St exit', 'Elizabeth St exit', 'Locked exit']);
    // Escalator 25 s then 35 s walk; the lift is slower so the escalator is chosen.
    assert.equal(exits[0].seconds, 60);
    assert.deepEqual(exits[0].steps.map(s => s.text), ['Take the escalator to Concourse, signed “Up to concourse”', 'Walk to Swanston St exit, signed “Swanston St”']);
    assert.equal(exits[0].stepFree, false);
    // 80 m at 1.2 m/s is 67 s when the feed gives no time.
    assert.equal(exits[1].seconds, 25 + 67);
    assert.deepEqual([exits[2].steps, exits[2].seconds, exits[2].stepFree], [[], null, null]);
    assert.equal(exits[0].levelName, 'Concourse');
});

test('a platform with only a lift reaches the exits step-free', async () => {
    sqlite.exec(`DELETE FROM pathways WHERE pathway_id IN ('w1', 'w1b')`);
    const result = await loadStationDetail(db, 1);
    if (result.status !== 'ok') return assert.fail('expected detail');
    assert.equal(result.detail.exits[0].stepFree, true);
    assert.equal(result.detail.exits[0].steps[0].text, 'Take the lift to Concourse, signed “Lift to concourse”');
});

test('a stop with a platform code but no parent station still gets its own detail', async () => {
    sqlite.exec(`INSERT INTO stop_platforms (stop_pk, parent_station, platform_code, level_id) VALUES (4, NULL, 'B', NULL)`);
    const result = await loadStationDetail(db, 4);
    if (result.status !== 'ok') return assert.fail('expected detail');
    assert.equal(result.detail.stationName, null);
    assert.deepEqual(result.detail.platforms.map(p => p.platformCode), ['B']);
    assert.deepEqual(result.detail.exits, []);
});

test('shortest paths use one-way edges only in their direction', () => {
    const edges = [edge('A', 'B', 1, { seconds: 10 }), edge('B', 'C', 1, { seconds: 10, bidirectional: true })];
    assert.equal(shortestPaths(edges, 'A').seconds.get('C'), 20);
    assert.equal(shortestPaths(edges, 'C').seconds.get('B'), 10);
    assert.equal(shortestPaths(edges, 'C').seconds.has('A'), false);
    assert.equal(pathTo(shortestPaths(edges, 'C'), 'A'), null);
    assert.deepEqual(pathTo(shortestPaths(edges, 'A'), 'A'), []);
});

test('the reverse of a two-way pathway uses the reverse signpost', () => {
    const edges = [edge('GN', 'EX', 1, { seconds: 10, bidirectional: true, signpost: 'Out', reverseSignpost: 'In' })];
    const back = pathTo(shortestPaths(edges, 'EX'), 'GN')!;
    assert.equal(back[0].signpost, 'In');
});

test('walkways with no signs between them merge into one step, gates stay unnamed', () => {
    const hops = pathTo(shortestPaths([
        edge('A', 'B', 1, { seconds: 10 }), edge('B', 'C', 1, { seconds: 15 }), edge('C', 'D', 6, { seconds: 5 }), edge('D', 'E', 7, { seconds: 5 }),
    ], 'A'), 'E')!;
    const steps = routeSteps(hops, id => ({ C: 'Hall', E: 'Street' } as Record<string, string>)[id] ?? null);
    assert.deepEqual(steps, [
        { text: 'Walk to Hall', seconds: 25 },
        { text: 'Go through the fare gates', seconds: 5 },
        { text: 'Go through the exit gate', seconds: 5 },
    ]);
    assert.equal(isStepFree(hops), true);
});

test('stairs and escalators are not step-free, and a stair count on a walkway is not either', () => {
    const hop = (mode: number, stairCount: number | null) => [{ fromId: 'a', toId: 'b', mode, seconds: 1, stairCount, signpost: null }];
    assert.equal(isStepFree(hop(2, null)), false);
    assert.equal(isStepFree(hop(4, null)), false);
    assert.equal(isStepFree(hop(1, 3)), false);
    assert.equal(isStepFree(hop(1, 0)), true);
});

test('station wording', async () => {
    const { exitSummary, formatWalkTime, platformSubtitle, platformTitle } = await import('@/services/gtfs/station/stationFormat');
    assert.equal(platformTitle({ platformCode: '2', name: 'Central Platform 2' }), 'Platform 2');
    assert.equal(platformTitle({ platformCode: null, name: 'Stop B' }), 'Stop B');
    assert.equal(platformSubtitle({ levelName: 'Platforms' }), 'Platforms level');
    assert.equal(platformSubtitle({ levelName: null }), '');
    assert.equal(formatWalkTime(20), 'about 1 min');
    assert.equal(formatWalkTime(150), 'about 3 min');
    assert.equal(exitSummary({ seconds: 90, stepFree: true }), 'about 2 min · step-free');
    assert.equal(exitSummary({ seconds: 90, stepFree: false }), 'about 2 min');
    assert.equal(exitSummary({ seconds: null, stepFree: null }), 'No route in the feed');
});
