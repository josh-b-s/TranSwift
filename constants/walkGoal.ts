// A weekly walking distance to aim for. Zero means no goal.
export const NO_WEEKLY_GOAL_M = 0;
export const MAX_WEEKLY_GOAL_M = 100_000;
export const WEEKLY_GOAL_STEP_M = 1000;

export function clampWeeklyGoal(meters: number): number {
    return Math.min(MAX_WEEKLY_GOAL_M, Math.max(NO_WEEKLY_GOAL_M, meters));
}
