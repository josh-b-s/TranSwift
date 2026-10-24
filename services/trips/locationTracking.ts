import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { dropWhileSimulating, subscribeSimulatedFixes } from '@/services/debug/locationSimulator';

const TASK_NAME = 'trip-location-updates';

const OPTIONS = {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 3,
};

type Listener = (locations: Location.LocationObject[]) => void;
let listener: Listener | null = null;

// Tasks must be defined at module scope, so this file is imported from app/_layout.tsx.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.warn('[trip] location task error:', error);
        return;
    }
    listener?.(data.locations);
});

const logStopFailure = (err: unknown) => console.warn('[trip] failed to stop location updates:', err);

async function startDeviceTracking(onLocations: Listener): Promise<() => void> {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== 'granted') throw new Error('Allow location access to record your trip.');

    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== 'granted') {
        const sub = await Location.watchPositionAsync(OPTIONS, location => onLocations([location]));
        return () => sub.remove();
    }

    // A task left running by a previous session would keep feeding the old listener.
    if (await Location.hasStartedLocationUpdatesAsync(TASK_NAME)) {
        await Location.stopLocationUpdatesAsync(TASK_NAME);
    }
    listener = onLocations;
    await Location.startLocationUpdatesAsync(TASK_NAME, {
        ...OPTIONS,
        activityType: Location.ActivityType.Fitness,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
            notificationTitle: 'Recording your trip',
            notificationBody: 'TranSwift is tracking your walk between stops.',
            killServiceOnDestroy: true,
        },
    });
    return () => {
        listener = null;
        Location.stopLocationUpdatesAsync(TASK_NAME).catch(logStopFailure);
    };
}

/**
 * Streams fixes to `onLocations`, including with the screen off when background permission is
 * granted, and otherwise only while the app is open. Returns a function that stops it.
 * Simulated fixes (see the debug movement controls) replace device fixes while they run.
 */
export async function startTracking(onLocations: Listener): Promise<() => void> {
    const stopDevice = await startDeviceTracking(dropWhileSimulating(onLocations));
    const stopSimulated = subscribeSimulatedFixes(onLocations);
    return () => {
        stopDevice();
        stopSimulated();
    };
}
