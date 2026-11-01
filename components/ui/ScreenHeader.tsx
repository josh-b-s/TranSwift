import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TOP_SAFE, useThemeStyle } from '@/constants/themes';

type Props = {
    title: string;
    /** Shows a back button before the title. */
    onBack?: () => void;
    /** Shown at the right end, such as an action button. */
    right?: React.ReactNode;
};

/** The big title at the top of a tab or settings screen. */
export default function ScreenHeader({ title, onBack, right }: Props) {
    const theme = useThemeStyle();
    const insets = useSafeAreaInsets();

    return (
        <View
            style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingTop: TOP_SAFE(insets), paddingHorizontal: 24, paddingBottom: 12,
                backgroundColor: theme.surfaceColor,
            }}
        >
            {onBack && (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    hitSlop={8}
                    onPress={onBack}
                    style={{ marginLeft: -10 }}
                >
                    <ChevronLeft size={30} color={theme.color} />
                </Pressable>
            )}
            <Text numberOfLines={1} style={{ flex: 1, color: theme.color, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 }}>{title}</Text>
            {right}
        </View>
    );
}
