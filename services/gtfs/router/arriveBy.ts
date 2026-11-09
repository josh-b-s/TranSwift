import type { GtfsJourney } from './routeTypes';

const MINUTE_MS = 60_000;
const DAY_S = 86_400;
// How far before the deadline the first search starts, doubled on each miss.
const FIRST_LEAD_MIN = 45;
const MAX_PASSES = 6;

type Search = (departure: Date) => Promise<GtfsJourney[]>;

const secondsOfDay = (clock: string) => {
    const [h, m, s = 0] = clock.split(':').map(Number);
    return h * 3600 + m * 60 + s;
};

/** When a journey from a search starting at `searchStart` leaves and arrives. The router's clocks wrap at midnight, so both are measured from the search start. */
function timesOf(journey: GtfsJourney, searchStart: Date): { leaveMs: number; arriveMs: number } {
    const startSod = searchStart.getHours() * 3600 + searchStart.getMinutes() * 60 + searchStart.getSeconds();
    let wait = (secondsOfDay(journey.departureTime) - startSod + DAY_S) % DAY_S;
    // A leave time a few seconds before the search start is rounding, not a day later.
    if (wait > DAY_S - 120) wait = 0;
    const leaveMs = searchStart.getTime() + wait * 1000;
    return { leaveMs, arriveMs: leaveMs + journey.totalDurationMin * MINUTE_MS };
}

/**
 * Journeys that get there by `deadlineMs`, leaving as late as they can. The router only searches forward, so this
 * searches from a guess and moves the start along by the slack until nothing arrives in time any more. Costs a few searches.
 */
export async function arriveBySearch(search: Search, deadlineMs: number, nowMs: number): Promise<GtfsJourney[]> {
    let lead = FIRST_LEAD_MIN * MINUTE_MS;
    let start = Math.max(nowMs, deadlineMs - lead);
    let best: { journeys: GtfsJourney[]; leaveMs: number } | null = null;

    for (let pass = 0; pass < MAX_PASSES; pass++) {
        const at = new Date(start);
        const found = (await search(at))
            .map(journey => ({ journey, ...timesOf(journey, at) }))
            .filter(t => t.arriveMs <= deadlineMs);

        if (found.length === 0) {
            if (best || start <= nowMs) break;
            lead *= 2;
            start = Math.max(nowMs, deadlineMs - lead);
            continue;
        }

        const leaveMs = Math.max(...found.map(t => t.leaveMs));
        if (best && leaveMs <= best.leaveMs) break;
        best = { journeys: found.map(t => t.journey), leaveMs };

        const slack = deadlineMs - Math.max(...found.map(t => t.arriveMs));
        start = leaveMs + Math.max(MINUTE_MS, slack);
    }
    return best?.journeys ?? [];
}
