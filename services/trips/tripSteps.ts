import type { LatLng } from '@/services/places/places';
import type { GtfsJourney } from '@/services/gtfs/router/raptorRouter';
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
};

export type TripStep = WalkStep | RideStep;

export function stepsFromJourney(journey: GtfsJourney): TripStep[] {
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
            };
        }
        // The first and last walks start or end wherever the rider is, so only the ones between stops repeat.
        return { ...base, type: 'walk', bestKey: i > 0 && i < last ? `${base.from}>${base.to}` : undefined };
    });
}
