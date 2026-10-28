import type { HistoryTrip } from './tripHistory';

export type HistoryChartMode = 'trips' | 'weeks' | 'months';

export type ChartPoint = { startMs: number; distanceM: number; durationS: number };

const TRIP_POINTS = 14;
const WEEK_POINTS = 8;
const MONTH_POINTS = 6;

/** Local midnight on the Monday of the week containing `ms`. */
export function weekStart(ms: number): number {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime();
}

export function monthStart(ms: number): number {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

const previousWeek = (startMs: number) => {
    const d = new Date(startMs);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7).getTime();
};

const previousMonth = (startMs: number) => {
    const d = new Date(startMs);
    return new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
};

/** The last `count` periods ending with the one that holds `nowMs`, oldest first, empty periods included. */
function periodStarts(nowMs: number, count: number, startOf: (ms: number) => number, previous: (ms: number) => number) {
    const starts = [startOf(nowMs)];
    while (starts.length < count) starts.unshift(previous(starts[0]));
    return starts;
}

function bucketTrips(trips: HistoryTrip[], starts: number[], startOf: (ms: number) => number): ChartPoint[] {
    const points = starts.map((startMs): ChartPoint => ({ startMs, distanceM: 0, durationS: 0 }));
    const indexByStart = new Map(starts.map((startMs, i) => [startMs, i]));
    for (const trip of trips) {
        const point = points[indexByStart.get(startOf(trip.startedAt)) ?? -1];
        if (!point) continue;
        point.distanceM += trip.totals.distanceM;
        point.durationS += trip.totals.durationS;
    }
    return points;
}

/**
 * What the history charts plot, oldest first. Trips mode is the latest walked trips; the other modes are fixed
 * calendar periods, so a quiet week shows as an empty bar.
 */
export function chartPoints(trips: HistoryTrip[], mode: HistoryChartMode, nowMs: number): ChartPoint[] {
    if (mode === 'weeks') return bucketTrips(trips, periodStarts(nowMs, WEEK_POINTS, weekStart, previousWeek), weekStart);
    if (mode === 'months') return bucketTrips(trips, periodStarts(nowMs, MONTH_POINTS, monthStart, previousMonth), monthStart);
    // Trips with no walking have no speed to plot. `trips` is newest first.
    return trips
        .filter(t => t.totals.distanceM > 0)
        .slice(0, TRIP_POINTS)
        .reverse()
        .map(t => ({ startMs: t.startedAt, distanceM: t.totals.distanceM, durationS: t.totals.durationS }));
}

/** Metres walked so far in the week that holds `nowMs`. */
export const weekDistanceM = (trips: HistoryTrip[], nowMs: number) =>
    trips.reduce((sum, t) => (weekStart(t.startedAt) === weekStart(nowMs) ? sum + t.totals.distanceM : sum), 0);

const dayKey = (ms: number) => {
    const d = new Date(ms);
    return d.getFullYear() * 10_000 + d.getMonth() * 100 + d.getDate();
};

/** Noon on the given day plus `offset` days: noon stays on the right date across daylight saving changes. */
const noonOnDay = (ms: number, offset = 0) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, 12).getTime();
};

/**
 * Days in a row with a walk, counting back from today. A day without a walk yet does not break the streak
 * until it is over, so the count starts from yesterday when today is empty.
 */
export function walkingStreak(trips: HistoryTrip[], nowMs: number): number {
    const walkedDays = new Set(trips.filter(t => t.totals.distanceM > 0).map(t => dayKey(t.startedAt)));
    let cursor = noonOnDay(nowMs);
    if (!walkedDays.has(dayKey(cursor))) cursor = noonOnDay(cursor, -1);

    let streak = 0;
    while (walkedDays.has(dayKey(cursor))) {
        streak++;
        cursor = noonOnDay(cursor, -1);
    }
    return streak;
}
