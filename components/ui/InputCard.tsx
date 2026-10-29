import React, { type ReactNode } from 'react';
import { Text, View, type TextStyle } from 'react-native';
import { useThemeStyle } from '@/constants/themes';

/** A rounded panel with a bold title, holding pill-shaped inputs. */
export default function InputCard({ title, children }: { title: string; children: ReactNode }) {
    const theme = useThemeStyle();
    return (
        <View style={{ backgroundColor: theme.backgroundColor, borderRadius: 28, paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}>
            <Text style={{ color: theme.color, fontSize: 18, fontWeight: '800' }}>{title}</Text>
            <View style={{ gap: 6 }}>{children}</View>
        </View>
    );
}

/** Style for a text input that sits on an InputCard: the page colour, so it reads as a cut-out. */
export function usePillStyle(): TextStyle {
    const theme = useThemeStyle();
    return {
        color: theme.color,
        fontSize: 14,
        backgroundColor: theme.surfaceColor,
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 8,
        minHeight: 36,
    };
}
