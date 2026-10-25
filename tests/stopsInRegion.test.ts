import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stopsInRegion } from '@/services/gtfs/departures/stopsInRegion';
import type { RepoStop } from '@/services/gtfs/core/stopRepo';

const stop = (pk: number, lat: number, lon: number): RepoStop =>
    ({ stop_pk: pk, stop_id: `s${pk}`, stop_name: `Stop ${pk}`, stop_lat: lat, stop_lon: lon, agency: 1 });
const region = (latitudeDelta: number) =>
    ({ latitude: -37.8, longitude: 144.9, latitudeDelta, longitudeDelta: latitudeDelta });

test('returns nothing when zoomed out', () => {
    assert.deepEqual(stopsInRegion([stop(1, -37.8, 144.9)], region(0.05)), []);
});

test('keeps only stops inside the visible area', () => {
    const inside = stop(1, -37.801, 144.901);
    const north = stop(2, -37.7, 144.9);
    const east = stop(3, -37.8, 145.1);
    assert.deepEqual(stopsInRegion([inside, north, east], region(0.01)), [inside]);
});

test('caps the count and keeps the stops nearest the centre', () => {
    const stops = Array.from({ length: 200 }, (_, i) => stop(i, -37.8 + i * 0.00002, 144.9));
    const shown = stopsInRegion(stops, region(0.02));
    assert.equal(shown.length, 150);
    assert.ok(shown.some(s => s.stop_pk === 0));
    assert.ok(!shown.some(s => s.stop_pk === 199));
});
