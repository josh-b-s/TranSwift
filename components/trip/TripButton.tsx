import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Play } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { selectDisplayedJourney } from '@/store/route.slice';
import { useStartTrip } from '@/hooks/startTrip';
import { ACCENT } from '@/constants/themes';

/** Starts the selected journey as a trip. Hidden while a trip runs, when ActiveTripPanel takes its place. */
export default function TripButton() {
    const startTrip = useStartTrip();
    const journey = useSelector(selectDisplayedJourney);
    const running = useSelector((s: RootState) => s.trip.startedAt !== null);

    if (running || !journey?.segments.length) return null;

    return (
        <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start trip"
                onPress={() => {
                    Haptics.selectionAsync();
                    startTrip(journey);
                }}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 24,
                    backgroundColor: ACCENT,
                }}
            >
                <Play size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Start trip</Text>
            </Pressable>
        </View>
    );
}
