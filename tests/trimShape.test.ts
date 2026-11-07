import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trimShapeToStops } from '@/services/gtfs/vehicles/trimShape';

const pt = (latitude: number, longitude: number) => ({ latitude, longitude });
// A line heading east along the equator, one point every 0.001 degrees (about 111 m).
const line = Array.from({ length: 11 }, (_, i) => pt(0, i * 0.001));

test('cuts a shape that runs past both end stops', () => {
    const out = trimShapeToStops(line, [pt(0, 0.002), pt(0, 0.004), pt(0, 0.008)]);
    assert.equal(out[0].longitude, 0.002);
    assert.equal(out[out.length - 1].longitude, 0.008);
    assert.ok(out.every((p) => p.longitude >= 0.002 && p.longitude <= 0.008));
});

test('extends a shape that stops short of the end stops', () => {
    const out = trimShapeToStops(line.slice(2, 8), [pt(0, 0.0005), pt(0, 0.0095)]);
    assert.deepEqual(out[0], pt(0, 0.0005));
    assert.deepEqual(out[out.length - 1], pt(0, 0.0095));
});

test('does not repeat an end point that already sits on its stop', () => {
    const out = trimShapeToStops(line, [pt(0, 0.002), pt(0, 0.008)]);
    assert.equal(out.length, 7);
});

test('keeps the direction of travel when the shape doubles back', () => {
    const there = [pt(0, 0), pt(0, 0.002), pt(0, 0.004)];
    const out = trimShapeToStops([...there, ...there.slice().reverse()], [pt(0, 0.004), pt(0, 0)]);
    assert.equal(out[0].longitude, 0.004);
    assert.equal(out[out.length - 1].longitude, 0);
});

test('leaves loop lines, missing stops and far-off shapes alone', () => {
    assert.equal(trimShapeToStops(line, [pt(0, 0.003), pt(0, 0.003)]), line);
    assert.equal(trimShapeToStops(line, [pt(0, 0.003)]), line);
    assert.equal(trimShapeToStops(line, [pt(1, 0.003), pt(1, 0.008)]), line);
});
