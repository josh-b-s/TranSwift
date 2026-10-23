import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CircleX, Clock, Footprints, Repeat } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { setDepartureTime, setWalkingSpeed } from '@/store/search.slice';
import { useRequestRoute } from '@/hooks/requestRoute';
import { useThemeStyle } from '@/constants/themes';
import DepartureTimeModal from '@/components/DepartureTimeModal';

/** Departure time and walking speed for the current route. Changing either recomputes it. */
export default function RouteOptionPills() {
    const dispatch = useDispatch<AppDispatch>();
    const theme = useThemeStyle();
    const requestRoute = useRequestRoute();
    const { departureTime, walkingSpeedMps } = useSelector((s: RootState) => s.search);
    // User-editable presets, see app/(tabs)/settings/preferences.tsx. Cycling steps
    // through the list in order and wraps at the end.
    const walkingSpeedOptions = useSelector((s: RootState) => s.preferences.walkingSpeeds);
    const [showTimeModal, setShowTimeModal] = useState(false);

    // Shows the raw m/s value when no preset matches (the matching one was edited or
    // removed) rather than mislabeling it as whichever preset comes first.
    const speedLabel = walkingSpeedOptions.find(o => o.mps === walkingSpeedMps)?.label
        ?? `${walkingSpeedMps.toFixed(1)} m/s`;

    const changeDeparture = useCallback((epochMs: number | null) => {
        dispatch(setDepartureTime(epochMs));
        requestRoute({ departureTime: epochMs });
    }, [dispatch, requestRoute]);

    const cycleWalkingSpeed = useCallback(() => {
        if (walkingSpeedOptions.length === 0) return;
        Haptics.selectionAsync();
        const idx = walkingSpeedOptions.findIndex(o => o.mps === walkingSpeedMps);
        const next = walkingSpeedOptions[(idx + 1) % walkingSpeedOptions.length];
        dispatch(setWalkingSpeed(next.mps));
        requestRoute({ walkingSpeedMps: next.mps });
    }, [walkingSpeedOptions, walkingSpeedMps, dispatch, requestRoute]);

    const pillStyle = {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: theme.color + '26',
    };
    const textStyle = { color: theme.color, fontSize: 13, fontWeight: '600' as const };

    return (
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingBottom: 12 }}>
            <Pressable
                style={pillStyle}
                accessibilityRole="button"
                accessibilityLabel="Set departure time"
                onPress={() => setShowTimeModal(true)}
            >
                <Clock size={16} color={theme.color} />
                <Text style={textStyle}>
                    {departureTime
                        ? new Date(departureTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : 'Leave now'}
                </Text>
                {departureTime !== null && (
                    <Pressable
                        onPress={() => changeDeparture(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Clear departure time"
                        hitSlop={8}
                    >
                        <CircleX size={14} color={theme.color} style={{ opacity: 0.5 }} />
                    </Pressable>
                )}
            </Pressable>

            <Pressable
                style={pillStyle}
                accessibilityRole="button"
                accessibilityLabel={`Walking speed: ${speedLabel}. Tap to cycle.`}
                onPress={cycleWalkingSpeed}
            >
                <Footprints size={16} color={theme.color} />
                <Text style={textStyle}>{speedLabel}</Text>
                {/* Marks it as a cycling control rather than a static label */}
                <Repeat size={11} color={theme.color} style={{ opacity: 0.45 }} />
            </Pressable>

            <DepartureTimeModal
                visible={showTimeModal}
                value={departureTime}
                onClose={() => setShowTimeModal(false)}
                onConfirm={changeDeparture}
            />
        </View>
    );
}
