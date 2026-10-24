import * as Notifications from 'expo-notifications';
import type { SpeedUnit } from '@/services/preferences/preferencesStore';
import { formatDistance, formatSpeed } from './tripFormat';
import type { TripSummary } from './tripSummary';

const CHANNEL_ID = 'trip-summaries';
const ALIGHT_CHANNEL_ID = 'get-off-alerts';

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
