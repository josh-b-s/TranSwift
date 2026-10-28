import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tripToGpx } from '@/services/trips/gpx';
import { projectLines, truncate } from '@/services/trips/shareCard';
import { encodePath } from '@/services/trips/pathCodec';
import { encodeLine } from '@/services/trips/lineCodec';
import type { SavedTrip } from '@/services/trips/tripStore';

const T0 = Date.UTC(2026, 9, 28, 1, 30, 0);

const trip: SavedTrip = {
    startedAt: T0,
    records: [],
    legs: [
        {
            kind: 'walk', stepIndex: 0, from: 'Home & Garden', to: 'Stop <A>',
            path: encodePath([
                { latitude: -37.8, longitude: 144.9, time: T0 },
                { latitude: -37.8005, longitude: 144.9, time: T0 + 10_000 },
            ]),
        },
        {
            kind: 'ride', stepIndex: 1, from: 'Stop <A>', to: 'Uni', routeName: '96', routeType: 0,
            line: encodeLine([{ latitude: -37.8005, longitude: 144.9 }, { latitude: -37.81, longitude: 144.95 }]),
        },
    ],
};

test('gpx has a timed track for a walk and an untimed one for a ride', () => {
    const gpx = tripToGpx(trip);
    assert.ok(gpx.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
    assert.match(gpx, /<trkpt lat="-37.800000" lon="144.900000"><time>2026-10-28T01:30:00.000Z<\/time><\/trkpt>/);
    assert.match(gpx, /<trkpt lat="-37.800500" lon="144.900000"><time>2026-10-28T01:30:10.000Z<\/time><\/trkpt>/);
    assert.match(gpx, /<trkpt lat="-37.810000" lon="144.950000"><\/trkpt>/);
    assert.equal(gpx.match(/<trk>/g)?.length, 2);
    assert.match(gpx, /<name>96: Stop &lt;A&gt; to Uni<\/name>/);
});

test('gpx escapes names and titles the file by the whole journey', () => {
    const gpx = tripToGpx(trip);
    assert.match(gpx, /<metadata><name>Home &amp; Garden to Uni<\/name>/);
    assert.ok(!gpx.includes('Stop <A>'));
});

const line = (coords: [number, number][], kind: 'walk' | 'ride' = 'walk') => ({
    kind, coords: coords.map(([latitude, longitude]) => ({ latitude, longitude })),
});

const parse = (points: string) => points.split(' ').map(p => p.split(',').map(Number));

test('projection fits inside the box, keeps north up and centres a narrow trip', () => {
    // 0.01 degrees north to south, almost no width.
    const [out] = projectLines([line([[-37.80, 144.9], [-37.81, 144.9001]])], 1000, 600);
    const [a, b] = parse(out.points);
    assert.ok(a[1] < b[1], 'the northern point is higher on the card');
    for (const [x, y] of [a, b]) {
        assert.ok(x >= 0 && x <= 1000 && y >= 0 && y <= 600);
    }
    assert.ok(Math.abs(b[1] - a[1] - 600) < 1, 'the tall dimension fills the box');
    assert.ok(Math.abs(a[0] - 500) < 10, 'centred horizontally');
});

test('east to west distances are scaled by the cosine of the latitude', () => {
    // At 60 degrees latitude a degree of longitude is half as long as a degree of latitude.
    const [out] = projectLines([line([[60, 10], [61, 10], [60, 11]])], 1000, 1000);
    const pts = parse(out.points);
    const dx = pts[2][0] - pts[0][0];
    const dy = pts[0][1] - pts[1][1];
    assert.ok(Math.abs(dx / dy - 0.5) < 0.02, `${dx} / ${dy}`);
});

test('a trip that never moved, and no trip at all, project without dividing by zero', () => {
    const [still] = projectLines([line([[-37.8, 144.9], [-37.8, 144.9]])], 800, 400);
    assert.deepEqual(parse(still.points), [[400, 200], [400, 200]]);
    assert.deepEqual(projectLines([], 800, 400), []);
});

test('rides keep their colour and kind', () => {
    const out = projectLines([line([[0, 0], [1, 1]]), { ...line([[1, 1], [2, 2]], 'ride'), color: '#FF0000' }], 100, 100);
    assert.deepEqual(out.map(l => [l.kind, l.color]), [['walk', undefined], ['ride', '#FF0000']]);
});

test('long names are cut with an ellipsis within the limit', () => {
    assert.equal(truncate('Short', 10), 'Short');
    const cut = truncate('Melbourne Central Station', 12);
    assert.equal(cut.length, 12);
    assert.ok(cut.endsWith('…'));
});
