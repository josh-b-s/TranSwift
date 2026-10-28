import React from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { ACCENT, useThemeStyle } from '@/constants/themes';

type Props = {
    label: string;
    options: string[];
    selected: string | null;
    onSelect: (option: string | null) => void;
    /** Shown before each option, e.g. "to". */
    prefix?: string;
};

/** A row of single-choice chips; tapping the chosen one again clears it. */
export default function DepartureFilterChips({ label, options, selected, onSelect, prefix = '' }: Props) {
    const theme = useThemeStyle();

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            accessibilityLabel={label}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 24, paddingBottom: 8 }}
        >
            {options.map(option => {
                const active = option === selected;
                return (
                    <Pressable
                        key={option}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => onSelect(active ? null : option)}
                        style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 999,
                            backgroundColor: active ? ACCENT : theme.backgroundColor,
                        }}
                    >
                        <Text style={{ color: active ? '#FFFFFF' : theme.color, fontSize: 13, fontWeight: '600' }}>
                            {prefix}{option}
                        </Text>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}
