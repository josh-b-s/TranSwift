/** Snapped to steps so a marker is not redrawn for every degree of drift. */
const BEARING_STEP = 15;

export const bearingBucket = (bearing: number | null) =>
    bearing === null ? null : (Math.round((((bearing % 360) + 360) % 360) / BEARING_STEP) * BEARING_STEP) % 360;

/** Where a heading dot sits around the centre of a badge, in screen units (x right, y down). */
export function pointerOffset(bearing: number, radius: number) {
    const radians = (bearing * Math.PI) / 180;
    return { x: Math.sin(radians) * radius, y: -Math.cos(radians) * radius };
}
