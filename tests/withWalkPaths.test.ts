import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withWalkPaths } from '@/services/routing/withWalkPaths';
import { parseWalkPath } from '@/services/routing/walkPath';
import { segmentMeters } from '@/services/gtfs/router/walkTimes';
import type { RouteSegment } from '@/services/gtfs/router/routeTypes';

const point = (latitude: number, longitude: number) => ({ latitude, longitude });

const segment = (type: 'walk' | 'transit'): RouteSegment => ({
    coords: [point(-37.8, 144.9), point(-37.81, 144.91)],
    routeName: '', routeType: type === 'walk' ? -1 : 3, originStopName: 'A', destStopName: 'B', type,
});

test('a walk takes the fetched path with its own endpoints on either end', async () => {
    const mid = point(-37.805, 144.9);
    const [walk] = await withWalkPaths([segment('walk')], async () => [mid]);
    assert.deepEqual(walk.coords, [point(-37.8, 144.9), mid, point(-37.81, 144.91)]);
});

test('rides are left alone', async () => {
    const ride = segment('transit');
    const [out] = await withWalkPaths([ride], async () => { throw new Error('should not be called'); });
    assert.equal(out, ride);
});

test('a failed request keeps the straight line', async () => {
    const walk = segment('walk');
    const warn = console.warn;
    console.warn = () => {};
    try {
        const [out] = await withWalkPaths([walk], async () => { throw new Error('boom'); });
        assert.equal(out, walk);
    } finally {
        console.warn = warn;
    }
});

test('the path joins the legs of the response without repeating the shared point', () => {
    const path = parseWalkPath({ features: [{ geometry: { coordinates: [[[144.9, -37.8], [144.91, -37.81]], [[144.91, -37.81], [144.92, -37.82]]] } }] });
    assert.deepEqual(path, [point(-37.8, 144.9), point(-37.81, 144.91), point(-37.82, 144.92)]);
});

test('a response with no geometry is an error', () => {
    assert.throws(() => parseWalkPath({}), /no geometry/);
});

test('segmentMeters adds up the legs of a line', () => {
    const line = { ...segment('walk'), coords: [point(-37.8, 144.9), point(-37.801, 144.9), point(-37.802, 144.9)] };
    // 0.002 degrees of latitude is about 222 m.
    assert.ok(Math.abs(segmentMeters(line) - 222.4) < 1);
});
