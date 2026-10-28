import type { StationExit, StationPlatform } from './stationDetail';

/** "Platform 2" when the feed gives a code, otherwise the stop's own name. */
export const platformTitle = (p: Pick<StationPlatform, 'platformCode' | 'name'>) =>
    p.platformCode ? `Platform ${p.platformCode}` : p.name;

/** "Platform 2 · Platforms level", leaving out what the feed does not say. */
export const platformSubtitle = (p: Pick<StationPlatform, 'levelName'>) => (p.levelName ? `${p.levelName} level` : '');

/** "about 2 min", never less than a minute. */
export const formatWalkTime = (seconds: number) => `about ${Math.max(1, Math.round(seconds / 60))} min`;

/** "about 2 min · step-free", or just the name's detail when the route is unknown. */
export function exitSummary(exit: Pick<StationExit, 'seconds' | 'stepFree'>): string {
    if (exit.seconds === null) return 'No route in the feed';
    return exit.stepFree ? `${formatWalkTime(exit.seconds)} · step-free` : formatWalkTime(exit.seconds);
}
