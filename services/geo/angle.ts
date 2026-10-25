/** Wraps any angle into [0, 360). */
export const normalizeDeg = (deg: number) => ((deg % 360) + 360) % 360;

/** Signed shortest turn from `from` to `to` in degrees, in [-180, 180). */
export const angleDeltaDeg = (from: number, to: number) => ((to - from + 540) % 360) - 180;
