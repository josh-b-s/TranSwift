import type { GtfsJourney } from './routeTypes';
import { walkSecondsByGap } from './walkTimes';

const DAY_S = 86_400;

/** "HH:MM:SS" for a time of day in seconds. Past midnight it wraps, as the router's clocks do. */
export function secToTimeString(sec?: number): string | undefined {
    if (sec === undefined) return undefined;
    const h = Math.floor(sec / 3600) % 24;
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const secondsOf = (time: string | undefined): number | null => {
    if (!time) return null;
    const [h, m, s = 0] = time.split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(s) ? h * 3600 + m * 60 + s : null;
};

/**
 * When the rider has to set off: the first boarding minus the walk to the stop. The router reports the time the
 * search started, which is earlier whenever the rider would wait at the stop. With no ride or no walk, `searchStartSec` stands.
 */
export function leaveSeconds(searchStartSec: number, firstBoardSec: number | undefined, walkToStopSec: number | null): number {
    if (firstBoardSec === undefined) return searchStartSec;
    return Math.round(firstBoardSec - (walkToStopSec ?? 0));
}

type Times = Pick<GtfsJourney, 'departureTime' | 'arrivalTime' | 'totalDurationMin'>;

/**
 * The journey's times from its walks as they are now: leave the walk to the first ride before it boards, arrive the
 * walk after the last ride once it alights. For when the walks were replaced by footpaths of another length. Null
 * when there is no ride to anchor to.
 */
export function retimeJourney(journey: GtfsJourney, speedMps: number): Times | null {
    const board = secondsOf(journey.legs[0]?.departureTime);
    const alight = secondsOf(journey.legs.at(-1)?.arrivalTime);
    if (board === null || alight === null) return null;

    const gaps = walkSecondsByGap(journey, speedMps);
    const leave = leaveSeconds(board, board, gaps[0]);
    const arrive = Math.round(alight + (gaps.at(-1) ?? 0));
    const duration = arrive - leave + (arrive < leave ? DAY_S : 0);
    return { departureTime: secToTimeString(leave)!, arrivalTime: secToTimeString(arrive)!, totalDurationMin: Math.floor(duration / 60) };
}
