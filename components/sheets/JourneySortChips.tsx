import React from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { ArrowLeftRight, Footprints, type LucideIcon, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ACCENT, useThemeStyle } from '@/constants/themes';

export type SortKey = 'arrival' | 'walking' | 'transfers';

const SORT_OPTIONS: { key: SortKey; label: string; icon: LucideIcon }[] = [
    { key: 'arrival',   label: 'Fastest',          icon: Zap },
    { key: 'walking',   label: 'Least walking',    icon: Footprints },
    { key: 'transfers', label: 'Fewest transfers', icon: ArrowLeftRight },
];

/** How the journey list is ordered. Scrolls sideways when the labels outgrow a narrow screen. */
export default function JourneySortChips({ value, onChange }: { value: SortKey; onChange: (key: SortKey) => void }) {
    const theme = useThemeStyle();

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            accessibilityRole="tablist"
            contentContainerStyle={{ gap: 8, paddingHorizontal: 24, paddingBottom: 12 }}
        >
            {SORT_OPTIONS.map(opt => {
                const active = value === opt.key;
                const color = active ? '#fff' : theme.color;
                return (
                    <Pressable
                        key={opt.key}
                        accessibilityRole="button"
                        accessibilityLabel={`Sort by ${opt.label}`}
                        accessibilityState={{ selected: active }}
                        onPress={() => {
                            Haptics.selectionAsync();
                            onChange(opt.key);
                        }}
                        style={{
                            flexDirection: 'row', alignItems: 'center', gap: 6,
                            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                            backgroundColor: active ? ACCENT : theme.backgroundColor,
                        }}
                    >
                        <opt.icon size={14} color={color} />
                        <Text style={{ color, fontSize: 13, fontWeight: '600' }}>{opt.label}</Text>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}
