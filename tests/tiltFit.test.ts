import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitTilt } from '@/services/geo/tiltFit';

// Projects a ground distance g the way a tilted plane viewed from d does.
const project = (g: number, pitchDeg: number, d: number) => {
    const p = (pitchDeg * Math.PI) / 180;
    return (g * Math.cos(p) * d) / (d + g * Math.sin(p));
};

test('recovers the perspective distance and the ground scale', () => {
    const d = 1350;
    const trueG = 180;
    const pitch = 60;
    const fit = fitTilt({
        farDp: project(trueG, pitch, d),
        nearDp: -project(-trueG, pitch, d),
        groundDp: 150,
        pitchDeg: pitch,
    });
    assert.ok(fit);
    assert.ok(Math.abs(fit.perspective - d) < 1);
    assert.ok(Math.abs(fit.scale - trueG / 150) < 1e-6);
});

test('says nothing for a flat map', () => {
    assert.equal(fitTilt({ farDp: 100, nearDp: 100, groundDp: 100, pitchDeg: 0 }), null);
});

test('says nothing for a point that did not land above the middle', () => {
    assert.equal(fitTilt({ farDp: -5, nearDp: 40, groundDp: 100, pitchDeg: 60 }), null);
});
