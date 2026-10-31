import React, { RefObject } from 'react';
import { Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import MapView from 'react-native-maps';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { AppDispatch, RootState } from '@/store/store';
import { selectPlace, setOrigin, stopPicking } from '@/store/search.slice';
import { makePinPlace } from '@/services/places/endpoints';
import { useRequestRoute } from '@/hooks/requestRoute';
import { ACCENT, RADIUS, SHADOW, TOP_SAFE, useThemeStyle } from '@/constants/themes';
import PlacePin, { DESTINATION_PIN_COLOR, ORIGIN_PIN_COLOR } from '@/components/map/PlacePin';

// Matches the drawing's own height, so the pin's tip sits on the map's centre.
const PIN_WIDTH = 36;
const PIN_HEIGHT = 44;

// Leaves room for the speedometer and locate buttons in the bottom corners.
const CONFIRM_SIDE_MARGIN = 84;

/** The map moves under a fixed centre pin; Confirm takes whatever is under it. */
export default function MapPickOverlay({ mapRef }: { mapRef: RefObject<MapView | null> }) {
    const dispatch = useDispatch<AppDispatch>();
    const theme = useThemeStyle();
    const insets = useSafeAreaInsets();
    const requestRoute = useRequestRoute();
    const field = useSelector((s: RootState) => s.search.pickingField);

    if (!field) return null;

    const isOrigin = field === 'origin';
    const color = isOrigin ? ORIGIN_PIN_COLOR : DESTINATION_PIN_COLOR;

    async function confirm() {
        const camera = await mapRef.current?.getCamera();
        if (!camera) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const pin = makePinPlace(camera.center);
        if (isOrigin) {
            dispatch(setOrigin(pin));
            requestRoute({ origin: pin });
        } else {
            dispatch(selectPlace(pin));
            requestRoute({ destination: pin });
        }
        dispatch(stopPicking());
    }

    return (
        <>
            <View
                pointerEvents="none"
                style={{
                    position: 'absolute', top: '50%', left: '50%',
                    marginLeft: -PIN_WIDTH / 2, marginTop: -PIN_HEIGHT,
                }}
            >
                <PlacePin color={color} />
            </View>

            <View
                style={[
                    {
                        position: 'absolute', left: 16, right: 16, top: TOP_SAFE(insets),
                        flexDirection: 'row', alignItems: 'center', gap: 12,
                        paddingVertical: 12, paddingLeft: 20, paddingRight: 12,
                        borderRadius: RADIUS.card + 4, backgroundColor: theme.backgroundColor,
                    },
                    SHADOW,
                ]}
            >
                <Text style={{ flex: 1, color: theme.color, fontSize: 16, fontWeight: '600' }}>
                    {isOrigin ? 'Move the map to set your start' : 'Move the map to set your destination'}
                </Text>
                <Pressable
                    onPress={() => dispatch(stopPicking())}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel choosing on map"
                    style={{
                        width: 32, height: 32, borderRadius: 16,
                        backgroundColor: theme.hairline,
                        alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <X size={18} color={theme.color} />
                </Pressable>
            </View>

            <Pressable
                onPress={confirm}
                accessibilityRole="button"
                style={[
                    {
                        position: 'absolute', left: CONFIRM_SIDE_MARGIN, right: CONFIRM_SIDE_MARGIN, bottom: 20,
                        paddingVertical: 16, borderRadius: RADIUS.card, alignItems: 'center',
                        backgroundColor: ACCENT,
                    },
                    SHADOW,
                ]}
            >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                    {isOrigin ? 'Set as start' : 'Set as destination'}
                </Text>
            </Pressable>
        </>
    );
}
