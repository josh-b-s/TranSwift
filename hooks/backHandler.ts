import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

/**
 * Handles the Android back button while `enabled`. The handler returns whether it used the press; if not, the press
 * goes on to the next handler and finally leaves the app. The most recently enabled handler is asked first.
 */
export function useBackHandler(enabled: boolean, handler: () => boolean) {
    // A ref so a new handler each render doesn't re-register and lose its place in the order.
    const latest = useRef(handler);
    latest.current = handler;

    useEffect(() => {
        if (!enabled) return;
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => latest.current());
        return () => subscription.remove();
    }, [enabled]);
}
