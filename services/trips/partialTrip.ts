/** A trip ended early is worth saving once the rider got through at least half its steps. */
export const followedEnough = (stepsDone: number, stepCount: number) =>
    stepsDone > 0 && stepsDone * 2 >= stepCount;
