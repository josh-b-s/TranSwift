import React, { RefObject, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import MapView from 'react-native-maps';
import Animated, { SharedValue } from 'react-native-reanimated';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bug, type LucideIcon, Minus, Play, Plus, Square } from 'lucide-react-native';
import { AppDispatch, RootState } from '@/store/store';
import { setUserLocation } from '@/store/location.slice';
import { useSimulation } from '@/hooks/simulation';
import { useSheetFollowTop } from '@/hooks/sheetFollowTop';
import {
    changeSimulatedSpeed,
    setSimulatedHeading,
    setSimulatedTimeScale,
    startSimulation,
    stopSimulation,
} from '@/services/debug/locationSimulator';
import { ACCENT, SHADOW, useThemeStyle } from '@/constants/themes';
import { SPEED_UNITS } from '@/constants/speedUnits';

const SPEED_STEP = 5;
const TIME_SCALES = [1, 2, 5, 10, 20, 50];
const NORTH = { icon: ArrowUp, label: 'Head north', deg: 0 };
const BOTTOM_ROW = [
    { icon: ArrowLeft, label: 'Head west', deg: 270 },
    { icon: ArrowDown, label: 'Head south', deg: 180 },
    { icon: ArrowRight, label: 'Head east', deg: 90 },
];

function PadButton({ icon: Icon, label, onPress, active = false }: {
    icon: LucideIcon;
    label: string;
    onPress: () => void;
    active?: boolean;
}) {
    const theme = useThemeStyle();
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? ACCENT : theme.surfaceColor,
            }}
        >
            <Icon size={20} color={active ? '#ffffff' : theme.color} />
        </Pressable>
    );
}

/** Dev-only panel for faking GPS: start at the map centre, steer by compass direction, change speed. */
export default function DebugMovementControls({ mapRef, animatedPosition, followsUser }: {
    mapRef: RefObject<MapView | null>;
    animatedPosition: SharedValue<number>;
    /** The map's own follow mode is steering the camera, so this must not. */
    followsUser: boolean;
}) {
    const dispatch = useDispatch<AppDispatch>();
    const theme = useThemeStyle();
    const top = useSheetFollowTop(animatedPosition);
    const unit = SPEED_UNITS[useSelector((s: RootState) => s.preferences.speedUnit)];
    const simulation = useSimulation();
    const [open, setOpen] = useState(false);

    // Duration matches the tick interval so the camera glides instead of stepping.
    useEffect(() => {
        if (simulation && !followsUser) mapRef.current?.animateCamera({ center: simulation.position }, { duration: 1000 });
    }, [simulation?.position, followsUser, mapRef]);

    // Store updates happen only on start and stop: Search re-queries Places on every change.
    const start = async () => {
        const camera = await mapRef.current?.getCamera();
        if (!camera) return;
        startSimulation(camera.center);
        dispatch(setUserLocation(camera.center));
    };

    const stop = () => {
        if (simulation) dispatch(setUserLocation(simulation.position));
        stopSimulation();
    };

    const stepTimeScale = (direction: 1 | -1) => {
        if (!simulation) return;
        const next = TIME_SCALES[TIME_SCALES.indexOf(simulation.timeScale) + direction];
        if (next) setSimulatedTimeScale(next);
    };

    const steer = ({ icon, label, deg }: typeof NORTH) => (
        <PadButton
            key={deg}
            icon={icon}
            label={label}
            active={simulation?.headingDeg === deg}
            onPress={() => setSimulatedHeading(deg)}
        />
    );

    return (
        <Animated.View style={{ top }}>
            <Pressable
                onPress={() => setOpen(o => !o)}
                accessibilityRole="button"
                accessibilityLabel="Toggle location simulator"
                style={[
                    {
                        position: 'absolute',
                        bottom: 88,
                        left: 16,
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: theme.backgroundColor,
                    },
                    SHADOW,
                ]}
            >
                <Bug size={24} color={simulation ? ACCENT : theme.color} />
            </Pressable>

            {open && (
                <View
                    style={[
                        {
                            position: 'absolute',
                            bottom: 152,
                            left: 16,
                            padding: 12,
                            gap: 12,
                            alignItems: 'center',
                            borderRadius: 16,
                            backgroundColor: theme.backgroundColor,
                        },
                        SHADOW,
                    ]}
                >
                    {simulation ? (
                        <>
                            <View style={{ alignItems: 'center', gap: 8 }}>
                                {steer(NORTH)}
                                <View style={{ flexDirection: 'row', gap: 8 }}>{BOTTOM_ROW.map(steer)}</View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <PadButton
                                    icon={Minus}
                                    label="Slower"
                                    onPress={() => changeSimulatedSpeed(-SPEED_STEP / unit.perMps)}
                                />
                                <Text style={{ color: theme.color, width: 72, textAlign: 'center', fontWeight: '700' }}>
                                    {Math.round(simulation.speedMps * unit.perMps)} {unit.label}
                                </Text>
                                <PadButton
                                    icon={Plus}
                                    label="Faster"
                                    onPress={() => changeSimulatedSpeed(SPEED_STEP / unit.perMps)}
                                />
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <PadButton icon={Minus} label="Slower time" onPress={() => stepTimeScale(-1)} />
                                <Text style={{ color: theme.color, width: 72, textAlign: 'center', fontWeight: '700' }}>
                                    {simulation.timeScale}x time
                                </Text>
                                <PadButton icon={Plus} label="Faster time" onPress={() => stepTimeScale(1)} />
                            </View>
                            <PadButton icon={Square} label="Stop simulating" onPress={stop} />
                        </>
                    ) : (
                        <Pressable
                            onPress={start}
                            accessibilityRole="button"
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                borderRadius: 12,
                                backgroundColor: ACCENT,
                            }}
                        >
                            <Play size={16} color="#ffffff" />
                            <Text style={{ color: '#ffffff', fontWeight: '600' }}>Start at map centre</Text>
                        </Pressable>
                    )}
                </View>
            )}
        </Animated.View>
    );
}
