// expo-location reports compass calibration as a level (0 worst, 3 best), not degrees.
// These half-angles are chosen by eye for each level, not measured.
const HALF_ANGLE_DEG_BY_LEVEL = [80, 50, 30, 15];
const UNKNOWN_HALF_ANGLE_DEG = 80;

/** Half-width in degrees of the cone drawn around the heading for a compass calibration level. */
export const headingHalfAngleDeg = (accuracyLevel: number) =>
    HALF_ANGLE_DEG_BY_LEVEL[accuracyLevel] ?? UNKNOWN_HALF_ANGLE_DEG;
