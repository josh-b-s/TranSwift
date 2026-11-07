import { test } from 'node:test';
import assert from 'node:assert/strict';
import { journeyDrawn, placeClosesDepartures, stopsTappable } from '@/services/trips/tapLayers';

const base = { hasPlace: false, tripRunning: false, detailOpen: false, picking: false, viewingSavedTrip: false, debug: false };

test('stops are tappable with no place, and under a running trip that holds one', () => {
    assert.equal(stopsTappable(base), true);
    assert.equal(stopsTappable({ ...base, hasPlace: true }), false);
    assert.equal(stopsTappable({ ...base, hasPlace: true, tripRunning: true }), true);
});

test('stops are never tappable while picking, viewing a saved trip or debugging', () => {
    for (const blocker of [{ picking: true }, { viewingSavedTrip: true }, { debug: true }]) {
        assert.equal(stopsTappable({ ...base, tripRunning: true, hasPlace: true, ...blocker }), false);
    }
});

test('a running trip keeps its route until a detail is tapped, then gets it back', () => {
    const running = { ...base, hasPlace: true, tripRunning: true };
    assert.equal(journeyDrawn(running), true);
    assert.equal(journeyDrawn({ ...running, detailOpen: true }), false);
    assert.equal(journeyDrawn({ ...running, detailOpen: false }), true);
});

test('a detail does not hide the route of a place when no trip runs', () => {
    assert.equal(journeyDrawn({ ...base, hasPlace: true, detailOpen: true }), true);
});

test('the journey is never drawn while viewing a saved trip or debugging', () => {
    assert.equal(journeyDrawn({ ...base, viewingSavedTrip: true }), false);
    assert.equal(journeyDrawn({ ...base, debug: true }), false);
});

test('departures survive a place only while a trip runs', () => {
    assert.equal(placeClosesDepartures({ ...base, hasPlace: true }), true);
    assert.equal(placeClosesDepartures({ ...base, hasPlace: true, tripRunning: true }), false);
    assert.equal(placeClosesDepartures({ ...base, viewingSavedTrip: true, tripRunning: true }), true);
});
