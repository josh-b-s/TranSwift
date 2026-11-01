import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RADIUS, SHADOW, TOP_SAFE, useThemeStyle } from '@/constants/themes';

/** Height of the bar with a title and a line under it, for sheets that must stop short of it. */
export const MAP_TOP_BAR_HEIGHT = 72;

type Props = {
    title: string;
    subtitle?: string;
    closeLabel: string;
    onClose: () => void;
};

/** The card floating at the top of the map while something is being done on it, with a button to leave. */
export default function MapTopBar({ title, subtitle, closeLabel, onClose }: Props) {
    const theme = useThemeStyle();
    const insets = useSafeAreaInsets();

    return (
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
            <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: theme.color, fontSize: 16, fontWeight: '600' }}>{title}</Text>
                {!!subtitle && <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 12, marginTop: 1 }}>{subtitle}</Text>}
            </View>
            <Pressable
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
            </Pressable>
        </View>
    );
}
