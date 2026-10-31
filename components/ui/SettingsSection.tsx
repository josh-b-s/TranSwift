import React from 'react';
import { Text, View } from 'react-native';
import { useThemeStyle } from '@/constants/themes';

/** A titled group on a settings screen, with an optional line explaining it. */
export default function SettingsSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
    const theme = useThemeStyle();

    return (
        <View style={{ gap: 8, marginTop: 12 }}>
            <View style={{ gap: 2, paddingHorizontal: 4 }}>
                <Text style={{ color: theme.color, fontSize: 15, fontWeight: '700' }}>{title}</Text>
                {!!hint && <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 18 }}>{hint}</Text>}
            </View>
            {children}
        </View>
    );
}
