import { encodeLine } from './lineCodec';
import type { RideStep } from './tripSteps';

/** The part of a ride between two of its stops, as a ride of its own. The line runs through the stops in between. */
export function rideBetween(step: RideStep, fromIndex: number, toIndex: number): RideStep {
    const stops = step.stops.slice(fromIndex, toIndex + 1);
    const first = stops[0];
    const last = stops[stops.length - 1];
    return {
        ...step,
        from: first.name,
        to: last.name,
        end: { latitude: last.latitude, longitude: last.longitude },
        stops,
        line: encodeLine(stops),
        // These belong to the whole ride, so they would point the live arrival and departure at the wrong stop.
        departureMs: undefined,
        arrivalMs: undefined,
        tripPk: undefined,
        alightSequence: undefined,
    };
}
