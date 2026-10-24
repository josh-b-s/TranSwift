import type { LocationObject } from 'expo-location';
import type { LatLng } from '@/services/places/places';

const TICK_MS = 1000;
const EARTH_RADIUS_M = 6_371_000;
const WALK_MPS = 1.4;
// Under the trip session's accuracy cutoff, so its fixes are never discarded.
const ACCURACY_M = 5;

/**
 * Null while not simulating. Heading is degrees clockwise from north. Speed is what the fixes
 * report, and `timeScale` is how many simulated seconds pass per real second.
 */
export type Simulation = { position: LatLng; headingDeg: number; speedMps: number; timeScale: number } | null;

type FixListener = (locations: LocationObject[]) => void;

let state: Simulation = null;
let timer: ReturnType<typeof setInterval> | undefined;
let lastTickAt = 0;
// Fixes are always one simulated second apart, however fast time runs, so arrival checks can't be skipped over.
let simClockMs = 0;
let pendingSimSeconds = 0;
const stateListeners = new Set<() => void>();
const fixListeners = new Set<FixListener>();

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

function setState(next: Simulation) {
    state = next;
    stateListeners.forEach(listener => listener());
}

function toFix(sim: NonNullable<Simulation>, timestamp: number): LocationObject {
    return {
        coords: {
            ...sim.position,
            altitude: null,
            accuracy: ACCURACY_M,
            altitudeAccuracy: null,
            heading: sim.headingDeg,
            speed: sim.speedMps,
        },
        timestamp,
    };
}

const emitFixes = (fixes: LocationObject[]) => fixListeners.forEach(listener => listener(fixes));

function moveOneSecond(sim: NonNullable<Simulation>): NonNullable<Simulation> {
    const heading = toRad(sim.headingDeg);
    const { latitude, longitude } = sim.position;
    return {
        ...sim,
        position: {
            latitude: latitude + toDeg((sim.speedMps * Math.cos(heading)) / EARTH_RADIUS_M),
            longitude: longitude + toDeg((sim.speedMps * Math.sin(heading)) / (EARTH_RADIUS_M * Math.cos(toRad(latitude)))),
        },
    };
}

function tick() {
    if (!state) return;
    const now = Date.now();
    // Real elapsed time, because setInterval drifts under load.
    pendingSimSeconds += ((now - lastTickAt) / 1000) * state.timeScale;
    lastTickAt = now;

    let sim = state;
    const fixes: LocationObject[] = [];
    while (pendingSimSeconds >= 1) {
        pendingSimSeconds -= 1;
        simClockMs += 1000;
        sim = moveOneSecond(sim);
        fixes.push(toFix(sim, simClockMs));
    }
    if (fixes.length === 0) return;
    setState(sim);
    emitFixes(fixes);
}

export function startSimulation(position: LatLng) {
    if (state) return;
    lastTickAt = Date.now();
    simClockMs = lastTickAt;
    pendingSimSeconds = 0;
    const sim = { position, headingDeg: 0, speedMps: WALK_MPS, timeScale: 1 };
    setState(sim);
    emitFixes([toFix(sim, simClockMs)]);
    timer = setInterval(tick, TICK_MS);
}

export function stopSimulation() {
    if (timer) clearInterval(timer);
    timer = undefined;
    setState(null);
}

export function setSimulatedHeading(headingDeg: number) {
    if (state) setState({ ...state, headingDeg });
}

export function changeSimulatedSpeed(deltaMps: number) {
    if (state) setState({ ...state, speedMps: Math.max(0, state.speedMps + deltaMps) });
}

export function setSimulatedTimeScale(timeScale: number) {
    if (state) setState({ ...state, timeScale });
}

export const getSimulation = () => state;

export function subscribeSimulation(listener: () => void) {
    stateListeners.add(listener);
    return () => {
        stateListeners.delete(listener);
    };
}

export function subscribeSimulatedFixes(listener: FixListener) {
    fixListeners.add(listener);
    return () => {
        fixListeners.delete(listener);
    };
}

/** Wraps a real GPS callback so device fixes don't fight the simulated ones. */
export const dropWhileSimulating =
    <A extends unknown[]>(listener: (...args: A) => void) =>
    (...args: A) => {
        if (!state) listener(...args);
    };
