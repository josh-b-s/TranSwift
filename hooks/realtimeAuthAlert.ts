import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { describeAuth, setAuthFailureListener } from '@/services/gtfs/realtime/authFailure';

/** Offers to open the feed settings when a realtime URL rejects the request for lack of a key. */
export function useRealtimeAuthAlert() {
    const router = useRouter();

    useEffect(() => {
        setAuthFailureListener((entry) => {
            Alert.alert(
                'Live data needs a key',
                `"${entry.name}" refused the realtime request. ${describeAuth(entry.realtimeAuth)}`,
                [
                    { text: 'Not now', style: 'cancel' },
                    { text: 'Open feeds', onPress: () => router.push('/settings/gtfs') },
                ],
            );
        });
        return () => setAuthFailureListener(null);
    }, [router]);
}
