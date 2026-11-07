import React from 'react';
import { Marker } from 'react-native-maps';
import { Text, View } from 'react-native';
import { ACCENT } from '@/constants/themes';

const BUBBLE_HEIGHT = 24;
const DOT_SIZE = 14;

/** Where the walker was, as a dot under a bubble with the speed. */
export default function SpeedMarker({ latitude, longitude, label }: { latitude: number; longitude: number; label: string }) {
    return (
        // The spacer under the dot matches the bubble so the dot sits at the marker's centre, which is the anchor.
        <Marker coordinate={{ latitude, longitude }} anchor={{ x: 0.5, y: 0.5 }} zIndex={9} tracksViewChanges>
            <View style={{ alignItems: 'center' }}>
                <View style={{ height: BUBBLE_HEIGHT, paddingHorizontal: 8, borderRadius: BUBBLE_HEIGHT / 2, justifyContent: 'center', backgroundColor: ACCENT }}>
                    <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>{label}</Text>
                </View>
                <View style={{ width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, backgroundColor: ACCENT, borderWidth: 3, borderColor: '#ffffff' }} />
                <View style={{ height: BUBBLE_HEIGHT }} />
            </View>
        </Marker>
    );
}
