import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import { autoUpdateFeeds } from '@/services/gtfs/update/autoUpdateFeeds';
import { currentConnection } from '@/services/gtfs/update/currentConnection';

/** Checks catalog feeds for a newer version on start and each time the app returns to the foreground, if the user allowed it. */
export function useAutoUpdateFeeds() {
    const consented = useSelector((s: RootState) => s.preferences.autoUpdateFeeds);

    useEffect(() => {
        if (!consented) return;
        const run = () => currentConnection().then((connection) => autoUpdateFeeds(true, connection));
        run().catch((err) => console.warn('[autoUpdate] check failed:', err));
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') run().catch((err) => console.warn('[autoUpdate] check failed:', err));
        });
        return () => sub.remove();
    }, [consented]);
}
