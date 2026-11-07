import type { HistoryTrip } from './tripHistory';

export type CalendarCell = {
    /** Local midnight of the day. */
    dayMs: number;
    /** False for the leading and trailing days that belong to a neighbouring month. */
    inMonth: boolean;
    tripCount: number;
    distanceM: number;
};

export const dayStart = (ms: number) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Local midnight on the first of the month `delta` months from the one holding `ms`. */
export const shiftMonth = (ms: number, delta: number) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth() + delta, 1).getTime();
};

/** Trips that started on the local day beginning at `dayMs`, newest first like the history list. */
export const tripsOnDay = (trips: HistoryTrip[], dayMs: number) => trips.filter(t => dayStart(t.startedAt) === dayMs);

/** The weeks of the month holding `monthMs`, Monday first, padded with neighbouring days to whole weeks. */
export function monthGrid(monthMs: number, trips: HistoryTrip[]): CalendarCell[][] {
    const first = new Date(monthMs);
    const year = first.getFullYear();
    const month = first.getMonth();
    const leading = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekCount = Math.ceil((leading + daysInMonth) / 7);

    const byDay = new Map<number, { tripCount: number; distanceM: number }>();
    for (const trip of trips) {
        const key = dayStart(trip.startedAt);
        const day = byDay.get(key) ?? { tripCount: 0, distanceM: 0 };
        day.tripCount += 1;
        day.distanceM += trip.totals.distanceM;
        byDay.set(key, day);
    }

    return Array.from({ length: weekCount }, (_, week) =>
        Array.from({ length: 7 }, (_, weekday): CalendarCell => {
            // Date normalises day numbers outside the month, which gives the neighbouring days.
            const d = new Date(year, month, 1 - leading + week * 7 + weekday);
            const dayMs = d.getTime();
            return { dayMs, inMonth: d.getMonth() === month, tripCount: 0, distanceM: 0, ...byDay.get(dayMs) };
        }),
    );
}
