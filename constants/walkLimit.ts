// Mirrors DEFAULT_MAX_WALK_DISTANCE_M in settings.rs (1.4 m/s for 20 min).
export const DEFAULT_MAX_WALK_DISTANCE_M = 1680;
export const MIN_MAX_WALK_DISTANCE_M = 200;
export const MAX_MAX_WALK_DISTANCE_M = 5000;
export const WALK_DISTANCE_STEP_M = 100;

export function clampWalkDistance(meters: number): number {
    return Math.min(MAX_MAX_WALK_DISTANCE_M, Math.max(MIN_MAX_WALK_DISTANCE_M, meters));
}
