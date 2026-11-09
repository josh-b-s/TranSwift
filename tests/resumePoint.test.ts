import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forgetResumePoint, rememberResumePoint, resumePointFor } from '@/services/trips/resumePoint';
import type { TripStep } from '@/services/trips/tripSteps';

const end = { latitude: 0, longitude: 0 };
const walk = (from: string, to: string): TripStep => ({ type: 'walk', from, to, end });
const stop = (name: string) => ({ name, latitude: 0, longitude: 0 });
const ride = (from: string, to: string): TripStep => ({
    type: 'transit', from, to, end, routeName: '86', routeType: 0, line: '', stops: [stop(from), stop('mid'), stop('mid2'), stop(to)], tripPk: 7,
});
const steps = [walk('Home', 'A'), ride('A', 'B'), walk('B', 'Work')];
const NOW = 1_000_000;

test('a trip ended on its second step resumes from that step', () => {
    forgetResumePoint();
    rememberResumePoint(steps, 1, false, null, NOW);
    const resume = resumePointFor(steps, NOW + 60_000);
    assert.equal(resume?.steps.length, 2);
    assert.equal(resume?.steps[0].from, 'A');
});

test('a ride resumes at the stop the rider had reached', () => {
    forgetResumePoint();
    rememberResumePoint(steps, 1, true, 1, NOW);
    assert.equal(resumePointFor(steps, NOW)?.reachedStop, 2);
});

test('a trip ended before anything was done leaves nothing to resume', () => {
    forgetResumePoint();
    rememberResumePoint(steps, 0, false, null, NOW);
    assert.equal(resumePointFor(steps, NOW), null);
});

test('a different journey does not resume', () => {
    forgetResumePoint();
    rememberResumePoint(steps, 1, true, 2, NOW);
    assert.equal(resumePointFor([walk('Home', 'C'), ride('C', 'D')], NOW), null);
});

test('an old stop is forgotten', () => {
    forgetResumePoint();
    rememberResumePoint(steps, 1, true, 2, NOW);
    assert.equal(resumePointFor(steps, NOW + 3 * 60 * 60_000), null);
});
