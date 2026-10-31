/** Snapped to steps so a marker is not redrawn for every degree of drift. */
const BEARING_STEP = 15;

export const bearingBucket = (bearing: number | null) =>
    bearing === null ? null : (Math.round((((bearing % 360) + 360) % 360) / BEARING_STEP) * BEARING_STEP) % 360;
