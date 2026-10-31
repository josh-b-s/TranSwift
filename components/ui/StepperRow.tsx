import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { RADIUS, useThemeStyle } from '@/constants/themes';

type Props = {
    /** The current value, already formatted. */
    label: string;
    onDecrease: () => void;
    onIncrease: () => void;
    canDecrease: boolean;
    canIncrease: boolean;
    decreaseLabel: string;
    increaseLabel: string;
};

/** A value between minus and plus buttons. */
export default function StepperRow({ label, onDecrease, onIncrease, canDecrease, canIncrease, decreaseLabel, increaseLabel }: Props) {
    const theme = useThemeStyle();
    const button = (enabled: boolean) => ({
        width: 40, height: 40, borderRadius: 20, alignItems: 'center' as const, justifyContent: 'center' as const,
        backgroundColor: theme.hairline, opacity: enabled ? 1 : 0.35,
    });

    return (
        <View
            style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                padding: 10, borderRadius: RADIUS.tile, backgroundColor: theme.backgroundColor,
            }}
        >
            <Pressable onPress={onDecrease} disabled={!canDecrease} hitSlop={6} accessibilityRole="button" accessibilityLabel={decreaseLabel} style={button(canDecrease)}>
                <Minus size={20} color={theme.color} />
            </Pressable>
            <Text style={{ color: theme.color, fontSize: 20, fontWeight: '700' }}>{label}</Text>
            <Pressable onPress={onIncrease} disabled={!canIncrease} hitSlop={6} accessibilityRole="button" accessibilityLabel={increaseLabel} style={button(canIncrease)}>
                <Plus size={20} color={theme.color} />
            </Pressable>
        </View>
    );
}
