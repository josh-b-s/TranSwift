import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepSpring } from '@/services/geo/spring';

test('settles on the target without overshooting', () => {
    const s = { value: 0, velocity: 0 };
    let peak = 0;
    for (let i = 0; i < 300; i++) {
        stepSpring(s, 1, 9, 16);
        peak = Math.max(peak, s.value);
    }
    assert.ok(peak <= 1);
    assert.ok(Math.abs(s.value - 1) < 1e-3);
});

test('starts gently: the first frame moves far less than an exponential ease would', () => {
    const s = { value: 0, velocity: 0 };
    stepSpring(s, 1, 9, 16);
    assert.ok(s.value < 0.01);
});

test('one long frame lands where many short ones do', () => {
    const a = { value: 0, velocity: 0 };
    const b = { value: 0, velocity: 0 };
    stepSpring(a, 1, 9, 160);
    for (let i = 0; i < 10; i++) stepSpring(b, 1, 9, 16);
    assert.ok(Math.abs(a.value - b.value) < 1e-9);
    assert.ok(Math.abs(a.velocity - b.velocity) < 1e-9);
});

test('keeps its velocity when the target flips mid-move', () => {
    const s = { value: 0, velocity: 0 };
    for (let i = 0; i < 20; i++) stepSpring(s, 1, 9, 16);
    const before = s.value;
    stepSpring(s, 0, 9, 16);
    assert.ok(s.value > before);
});
