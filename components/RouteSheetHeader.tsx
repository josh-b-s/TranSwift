import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ACCENT, useThemeStyle } from '@/constants/themes';

type Props = {
    name: string;
    address?: string;
    onClose: () => void;
};

export default function RouteSheetHeader({ name, address, onClose }: Props) {
    const theme = useThemeStyle();

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingBottom: 12 }}>
            <View
                style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: ACCENT + '1f',
                    alignItems: 'center', justifyContent: 'center',
                }}
            >
                <Ionicons name="location-sharp" size={18} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: theme.color, fontSize: 17, fontWeight: '700' }}>{name}</Text>
                {!!address && (
                    <Text numberOfLines={1} style={{ color: theme.color, opacity: 0.55, fontSize: 13, marginTop: 1 }}>
                        {address}
                    </Text>
                )}
            </View>
            <Pressable
                onPress={onClose}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close route"
                style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: theme.color + '14',
                    alignItems: 'center', justifyContent: 'center',
                }}
            >
                <Ionicons name="close" size={18} color={theme.color} />
            </Pressable>
        </View>
    );
}
