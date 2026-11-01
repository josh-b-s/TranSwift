import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store/store';
import { viewTrip } from '@/store/tripView.slice';

/** Opens the trip summary when the app is opened from its completion notification. */
export function useTripNotificationTap() {
    const dispatch = useDispatch<AppDispatch>();
    const response = Notifications.useLastNotificationResponse();
    const id = response?.notification.request.identifier;

    useEffect(() => {
        const startedAt = Number(response?.notification.request.content.data?.startedAt);
        if (!startedAt) return;
        dispatch(viewTrip({ startedAt }));
        router.navigate('/');
        // Otherwise the same response would reopen the summary on a later launch.
        Notifications.clearLastNotificationResponse();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);
}
