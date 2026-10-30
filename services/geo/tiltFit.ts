export type TiltFit = {
    /** Distance of the viewer from the ground, in dp, for CSS-style `perspective`. */
    perspective: number;
    /** How many times the ground is longer on screen than `groundDp` said it would be. */
    scale: number;
};

/**
 * Works out how a tilted map really projects the ground, from two points the map itself placed on screen.
 *
 * The points are the same ground distance in front of and behind the camera's middle, along the way the map faces.
 * `farDp` and `nearDp` are how far above and below the middle they landed. On a tilted plane seen with perspective the
 * far one is squeezed and the near one stretched, and how unevenly tells how close the viewer is. `groundDp` is what
 * that ground distance would be in dp on a flat map, and `pitchDeg` is the tilt. Returns null when the two points
 * are too alike to say anything, as on a flat map.
 */
export function fitTilt({ farDp, nearDp, groundDp, pitchDeg }: {
    farDp: number;
    nearDp: number;
    groundDp: number;
    pitchDeg: number;
}): TiltFit | null {
    const pitch = (pitchDeg * Math.PI) / 180;
    const ratio = nearDp / farDp;
    if (!(farDp > 0) || !(ratio > 1.001)) return null;

    // Ground point at distance g, tilted by `pitch` and viewed from d, lands at g*cos(pitch)*d / (d +- g*sin(pitch)).
    const tan = Math.tan(pitch);
    const perspective = (2 * ratio * tan * farDp) / (ratio - 1);
    const trueGroundDp = (2 * ratio * tan * farDp) / ((ratio + 1) * Math.sin(pitch));
    return { perspective, scale: trueGroundDp / groundDp };
}
