import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

/** Opens the trip summary when the app is opened from its completion notification. */
export function useTripNotificationTap() {
    const response = Notifications.useLastNotificationResponse();
    const id = response?.notification.request.identifier;

    useEffect(() => {
        const startedAt = Number(response?.notification.request.content.data?.startedAt);
        if (!startedAt) return;
        router.push(`/trip/${startedAt}`);
        // Otherwise the same response would reopen the summary on a later launch.
        Notifications.clearLastNotificationResponse();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);
}
