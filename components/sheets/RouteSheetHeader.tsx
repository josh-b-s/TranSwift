import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MapPin, Star, X } from 'lucide-react-native';
import { ACCENT, useThemeStyle } from '@/constants/themes';

type Props = {
    name: string;
    address?: string;
    closeLabel?: string;
    /** When given, a star button saves or unsaves the place. */
    saved?: { active: boolean; onToggle: () => void };
    /** Without it there is no close button. */
    onClose?: () => void;
};

export default function RouteSheetHeader({ name, address, closeLabel = 'Close route', saved, onClose }: Props) {
    const theme = useThemeStyle();

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingBottom: 12 }}>
            <View
                style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: theme.accentSoft,
                    alignItems: 'center', justifyContent: 'center',
                }}
            >
                <MapPin size={18} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: theme.color, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 }}>{name}</Text>
                {!!address && (
                    <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 13, marginTop: 1 }}>
                        {address}
                    </Text>
                )}
            </View>
            {saved && (
                <Pressable
                    onPress={saved.onToggle}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={saved.active ? 'Remove from saved places' : 'Save place'}
                    style={{ padding: 4 }}
                >
                    <Star size={22} color={ACCENT} fill={saved.active ? ACCENT : 'none'} />
                </Pressable>
            )}
            {onClose && <Pressable
                onPress={onClose}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={closeLabel}
                style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: theme.hairline,
                    alignItems: 'center', justifyContent: 'center',
                }}
            >
                <X size={18} color={theme.color} />
            </Pressable>}
        </View>
    );
}
