import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { SpeedUnit } from '@/services/preferences/preferencesStore';
import { formatDistance, formatSpeed, stopsToGo } from './tripFormat';
import type { TripSummary } from './tripSummary';

const CHANNEL_ID = 'trip-summaries';
const ALIGHT_CHANNEL_ID = 'get-off-alerts';
const PROGRESS_CHANNEL_ID = 'ride-progress';
const PROGRESS_ID = 'ride-progress';

// Without this, notifications are dropped while the app is open, and a rider may be looking at the map.
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function requestNotificationPermission(): Promise<void> {
    await Notifications.requestPermissionsAsync();
}

/** For a trip that finishes while the app is in the background. Tapping it opens the summary. */
export async function notifyTripDone(startedAt: number, summary: TripSummary, unit: SpeedUnit): Promise<void> {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Trip summaries',
        importance: Notifications.AndroidImportance.HIGH,
    });
    const body = summary.distanceM > 0
        ? `${formatDistance(summary.distanceM)} walked at ${formatSpeed(summary.avgSpeedMps, unit)}. Tap for your summary.`
        : 'Tap for your summary.';
    await Notifications.scheduleNotificationAsync({
        content: { title: 'Trip complete', body, data: { startedAt } },
        trigger: { channelId: CHANNEL_ID },
    });
}

/** Fires immediately, so call it only when the rider is about to reach the stop. */
export async function notifyGetOff(stopName: string): Promise<void> {
    await Notifications.setNotificationChannelAsync(ALIGHT_CHANNEL_ID, {
        name: 'Get-off alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 200, 400],
    });
    await Notifications.scheduleNotificationAsync({
        content: { title: 'Get off at the next stop', body: stopName },
        trigger: { channelId: ALIGHT_CHANNEL_ID },
    });
}

/** Keeps one quiet notification up during a ride, replaced in place as the stops count down. Android only, since iOS can't pin one. */
export async function showRideProgress(routeName: string, stopName: string, stopsLeft: number): Promise<void> {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(PROGRESS_CHANNEL_ID, {
        name: 'Ride progress',
        importance: Notifications.AndroidImportance.LOW,
    });
    await Notifications.scheduleNotificationAsync({
        identifier: PROGRESS_ID,
        content: { title: `${routeName} to ${stopName}`, body: stopsToGo(stopsLeft), sticky: true, autoDismiss: false },
        trigger: { channelId: PROGRESS_CHANNEL_ID },
    });
}

export async function clearRideProgress(): Promise<void> {
    await Notifications.dismissNotificationAsync(PROGRESS_ID);
}
