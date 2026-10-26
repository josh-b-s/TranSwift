import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findRepoStop } from '@/services/gtfs/departures/findRepoStop';
import type { RepoStop } from '@/services/gtfs/core/stopRepo';

const stop = (pk: number, name: string, lat: number, lon: number): RepoStop =>
    ({ stop_pk: pk, stop_id: `s${pk}`, stop_name: name, stop_lat: lat, stop_lon: lon, agency: 1 });
const target = (name: string, latitude: number, longitude: number) => ({ name, latitude, longitude });

test('matches the stop at the same position', () => {
    const stops = [stop(1, 'Flinders St', -37.8183, 144.9671)];
    assert.equal(findRepoStop(stops, target('Flinders St', -37.8183, 144.9671))?.stop_pk, 1);
});

test('returns null when nothing is within 50 m', () => {
    const stops = [stop(1, 'Flinders St', -37.8183, 144.9671)];
    assert.equal(findRepoStop(stops, target('Flinders St', -37.8193, 144.9671)), null);
});

test('prefers the same name over a closer stop with another name', () => {
    const stops = [
        stop(1, 'Opposite side', -37.81830, 144.9671),
        stop(2, 'Flinders St', -37.81840, 144.9671),
    ];
    assert.equal(findRepoStop(stops, target('Flinders St', -37.81830, 144.9671))?.stop_pk, 2);
});

test('falls back to the nearest stop when no name matches', () => {
    const stops = [
        stop(1, 'Far', -37.81850, 144.9671),
        stop(2, 'Near', -37.81832, 144.9671),
    ];
    assert.equal(findRepoStop(stops, target('Renamed', -37.8183, 144.9671))?.stop_pk, 2);
});
