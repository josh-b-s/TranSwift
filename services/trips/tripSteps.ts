import type { LatLng } from '@/services/places/places';
import type { GtfsJourney, RouteStop } from '@/services/gtfs/router/routeTypes';
import { encodeLine } from './lineCodec';

type StepBase = { from: string; to: string; end: LatLng };

/** `bestKey` is set only when the walk repeats exactly, so earlier attempts are comparable. */
export type WalkStep = StepBase & { type: 'walk'; bestKey?: string };

/** `line` is the ride's shape from board to alight stop, snapshotted so the trip outlives the feed. */
export type RideStep = StepBase & {
    type: 'transit';
    routeName: string;
    routeType: number;
    routeColor?: string;
    routeTextColor?: string;
    line: string;
    /** Board to alight, so the alert can tell when the stop before yours is near. */
    stops: RouteStop[];
    /** When the ride is due at its last stop. Includes the realtime delays known when the journey was planned. */
    arrivalMs?: number;
    /** The trip and the stop sequence it gets off at, to refresh the arrival time from realtime data during the ride. */
    tripPk?: number;
    alightSequence?: number;
};

export type TripStep = WalkStep | RideStep;

/** Today at a "HH:MM:SS" time of day. A time hours in the past is taken to be tomorrow, for a trip that crosses midnight. */
function clockToMs(clock: string, now: Date): number {
    const [h, m, s] = clock.split(':').map(Number);
    const d = new Date(now);
    d.setHours(h, m, s, 0);
    return d.getTime() < now.getTime() - 6 * 3_600_000 ? d.getTime() + 24 * 3_600_000 : d.getTime();
}

export function stepsFromJourney(journey: GtfsJourney, now = new Date()): TripStep[] {
    const last = journey.segments.length - 1;
    return journey.segments.map((seg, i): TripStep => {
        const base = { from: seg.originStopName, to: seg.destStopName, end: seg.coords[seg.coords.length - 1] };
        if (seg.type === 'transit') {
            return {
                ...base,
                type: 'transit',
                routeName: seg.routeName,
                routeType: seg.routeType,
                routeColor: seg.routeColor,
                routeTextColor: seg.routeTextColor,
                line: encodeLine(seg.coords),
                stops: seg.stops ?? [],
                arrivalMs: seg.arrivalTime ? clockToMs(seg.arrivalTime, now) : undefined,
                tripPk: seg.tripPk,
                alightSequence: seg.alightSequence,
            };
        }
        // The first and last walks start or end wherever the rider is, so only the ones between stops repeat.
        return { ...base, type: 'walk', bestKey: i > 0 && i < last ? `${base.from}>${base.to}` : undefined };
    });
}
