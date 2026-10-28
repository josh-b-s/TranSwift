import {
    MODE_ELEVATOR, MODE_ESCALATOR, MODE_EXIT_GATE, MODE_FARE_GATE, MODE_MOVING_WALKWAY, MODE_STAIRS, MODE_WALKWAY,
    type Hop,
} from './pathwayGraph';

export type RouteStep = { text: string; seconds: number };

const VERB: Record<number, string> = {
    [MODE_WALKWAY]: 'Walk',
    [MODE_STAIRS]: 'Take the stairs',
    [MODE_MOVING_WALKWAY]: 'Take the moving walkway',
    [MODE_ESCALATOR]: 'Take the escalator',
    [MODE_ELEVATOR]: 'Take the lift',
    [MODE_FARE_GATE]: 'Go through the fare gates',
    [MODE_EXIT_GATE]: 'Go through the exit gate',
};

const GATES = new Set([MODE_FARE_GATE, MODE_EXIT_GATE]);

/** Stairs and escalators are not step-free; a pathway that says it has stairs is not either. */
export const isStepFree = (hops: Hop[]) =>
    hops.every(h => h.mode !== MODE_STAIRS && h.mode !== MODE_ESCALATOR && !(h.stairCount && h.stairCount > 0));

/**
 * Turns hops into instructions. Plain walkways that follow each other, with no sign to read between them, become
 * one "Walk to ..." step.
 */
export function routeSteps(hops: Hop[], nameOf: (id: string) => string | null): RouteStep[] {
    const merged: Hop[][] = [];
    for (const hop of hops) {
        const previous = merged[merged.length - 1]?.slice(-1)[0];
        const joins = previous && hop.mode === MODE_WALKWAY && previous.mode === MODE_WALKWAY && !hop.signpost && !previous.signpost;
        if (joins) merged[merged.length - 1].push(hop);
        else merged.push([hop]);
    }

    return merged.map(group => {
        const last = group[group.length - 1];
        const place = nameOf(last.toId);
        const verb = VERB[last.mode] ?? 'Continue';
        let text = place && !GATES.has(last.mode) ? `${verb} to ${place}` : verb;
        if (last.signpost) text += `, signed “${last.signpost}”`;
        return { text, seconds: group.reduce((sum, h) => sum + h.seconds, 0) };
    });
}
