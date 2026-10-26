// A stop circle is a round-capped line, and the line's length shows when it is longer than its width. Half the
// visible map height is the scale: about 1/800 of it, so the line stays a pixel or two at any zoom.
const MAP_HEIGHT_DP = 800;

/**
 * Half the line length, in degrees of latitude, for a map showing `latitudeDelta`. The delta is rounded to a power
 * of two so the length, and so every circle's coordinates, only change when the zoom doubles or halves.
 */
export function dotHalfLengthDeg(latitudeDelta: number): number {
    return 2 ** Math.round(Math.log2(latitudeDelta)) / MAP_HEIGHT_DP;
}
