import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, CircleX, Clock, Footprints } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { setDepartureTime, setWalkingSpeed } from '@/store/search.slice';
import { useRequestRoute } from '@/hooks/requestRoute';
import { ACCENT, useThemeStyle } from '@/constants/themes';
import DepartureTimeModal from '@/components/search/DepartureTimeModal';
import Dropdown from '@/components/ui/Dropdown';
import { formatMps, walkingSpeedLabel } from '@/services/preferences/walkingSpeed';

/** Departure time and walking speed for the current route. Changing either recomputes it. */
export default function RouteOptionPills() {
    const dispatch = useDispatch<AppDispatch>();
    const theme = useThemeStyle();
    const requestRoute = useRequestRoute();
    const { departureTime, walkingSpeedMps } = useSelector((s: RootState) => s.search);
    // User-editable presets, see app/(tabs)/settings/preferences.tsx.
    const walkingSpeedOptions = useSelector((s: RootState) => s.preferences.walkingSpeeds);
    const [showTimeModal, setShowTimeModal] = useState(false);

    // Shows the raw m/s value when no preset matches (the matching one was edited or
    // removed) rather than mislabeling it as whichever preset comes first.
    const current = walkingSpeedOptions.find(o => o.mps === walkingSpeedMps);
    const speedLabel = current ? walkingSpeedLabel(current) : formatMps(walkingSpeedMps);

    const changeDeparture = useCallback((epochMs: number | null) => {
        dispatch(setDepartureTime(epochMs));
        requestRoute({ departureTime: epochMs });
    }, [dispatch, requestRoute]);

    const chooseWalkingSpeed = useCallback((mps: number) => {
        Haptics.selectionAsync();
        dispatch(setWalkingSpeed(mps));
        requestRoute({ walkingSpeedMps: mps });
    }, [dispatch, requestRoute]);

    const pillStyle = {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: theme.backgroundColor,
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
                <Clock size={16} color={ACCENT} />
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

            <Dropdown
                options={walkingSpeedOptions.map(o => ({ value: o.mps, label: walkingSpeedLabel(o) }))}
                value={current ? current.mps : null}
                onChange={chooseWalkingSpeed}
                renderTrigger={({ onPress }) => (
                    <Pressable
                        style={pillStyle}
                        accessibilityRole="button"
                        accessibilityLabel={`Walking speed: ${speedLabel}. Tap to choose.`}
                        onPress={onPress}
                    >
                        <Footprints size={16} color={ACCENT} />
                        <Text style={textStyle}>{speedLabel}</Text>
                        <ChevronDown size={14} color={theme.color} style={{ opacity: 0.45 }} />
                    </Pressable>
                )}
            />

            <DepartureTimeModal
                visible={showTimeModal}
                value={departureTime}
                onClose={() => setShowTimeModal(false)}
                onConfirm={changeDeparture}
            />
        </View>
    );
}
