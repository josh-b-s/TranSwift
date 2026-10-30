export type Spring = { value: number; velocity: number };

/**
 * Moves `s` toward `target` over `dtMs` as a critically damped spring: no overshoot, and it starts and stops gently,
 * unlike a plain exponential ease, which leaps away at full speed. `rate` is in radians per second; larger is quicker.
 * Closed form, so it stays stable however long a frame took.
 */
export function stepSpring(s: Spring, target: number, rate: number, dtMs: number) {
    const dt = dtMs / 1000;
    const offset = s.value - target;
    const carry = s.velocity + rate * offset;
    const decay = Math.exp(-rate * dt);
    s.value = target + (offset + carry * dt) * decay;
    s.velocity = (s.velocity - rate * carry * dt) * decay;
}
