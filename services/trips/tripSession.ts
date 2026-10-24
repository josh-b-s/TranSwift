import { haversineMeters } from '@/services/geo/geoUtil';
import type { LatLng } from '@/services/places/places';
import { encodePath, type Sample } from './pathCodec';
import type { TripStep } from './tripSteps';
import type { SavedLeg } from './tripStore';

const ARRIVE_RADIUS_M = 40;
const MAX_ACCURACY_M = 30;

export type Fix = Sample & { accuracy: number | null };

const isNear = (fix: Sample, target: LatLng) =>
    haversineMeters(
        { lat: fix.latitude, lon: fix.longitude },
        { lat: target.latitude, lon: target.longitude },
    ) <= ARRIVE_RADIUS_M;

/** Walks through a journey's steps from GPS fixes, recording the rider's path on walks and the line on rides. */
export function createTripSession(steps: TripStep[]) {
    let index = 0;
    let samples: Sample[] = [];
    const legs: SavedLeg[] = [];

    const finishStep = () => {
        const step = steps[index];
        if (step.type === 'transit') {
            legs.push({
                kind: 'ride',
                stepIndex: index,
                from: step.from,
                to: step.to,
                routeName: step.routeName,
                routeType: step.routeType,
                routeColor: step.routeColor,
                routeTextColor: step.routeTextColor,
                line: step.line,
            });
        } else if (samples.length > 1) {
            legs.push({
                kind: 'walk',
                stepIndex: index,
                from: step.from,
                to: step.to,
                bestKey: step.bestKey,
                path: encodePath(samples),
            });
        }
        samples = [];
        index += 1;
    };

    return {
        get stepIndex() { return index; },
        get done() { return index >= steps.length; },
        get legs() { return legs; },

        addFix({ latitude, longitude, time, accuracy }: Fix) {
            if (index >= steps.length) return;
            if (accuracy === null || accuracy > MAX_ACCURACY_M) return;

            if (steps[index].type === 'walk') samples.push({ latitude, longitude, time });
            // A loop, since a very short step can already be satisfied by the same fix.
            while (index < steps.length && isNear({ latitude, longitude, time }, steps[index].end)) finishStep();
        },
    };
}
