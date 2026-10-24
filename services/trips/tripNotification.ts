import * as Notifications from 'expo-notifications';
import type { SpeedUnit } from '@/services/preferences/preferencesStore';
import { formatDistance, formatSpeed } from './tripFormat';
import type { TripSummary } from './tripSummary';

const CHANNEL_ID = 'trip-summaries';

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
