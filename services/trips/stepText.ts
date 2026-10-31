import type { TripStep } from './tripSteps';

/** What the rider is doing now. A ride they haven't boarded yet reads as boarding it. */
export function stepHeadline(step: TripStep, boarded: boolean): string {
    if (step.type === 'walk') return `Walk to ${step.to}`;
    return boarded ? `${step.routeName} to ${step.to}` : `Board ${step.routeName} at ${step.from}`;
}

/** What comes after, or null on the last step. */
export function nextStepLine(next: TripStep | undefined): string | null {
    if (!next) return null;
    return next.type === 'walk' ? `Then walk to ${next.to}` : `Then ride ${next.routeName}`;
}
