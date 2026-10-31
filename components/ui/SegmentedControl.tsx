import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ACCENT, RADIUS, useThemeStyle } from '@/constants/themes';

type Option<T extends string> = { value: T; label: string; icon?: LucideIcon };

type Props<T extends string> = {
    options: Option<T>[];
    value: T;
    onChange: (value: T) => void;
};

export default function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
    const theme = useThemeStyle();

    return (
        <View style={{ flexDirection: 'row', borderRadius: RADIUS.tile, padding: 4, gap: 4, backgroundColor: theme.backgroundColor }}>
            {options.map((opt) => {
                const active = opt.value === value;
                const Icon = opt.icon;
                return (
                    <Pressable
                        key={opt.value}
                        onPress={() => onChange(opt.value)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: 11,
                            gap: 4,
                            borderRadius: RADIUS.tile - 4,
                            backgroundColor: active ? ACCENT : 'transparent',
                        }}
                    >
                        {Icon && <Icon size={18} color={active ? '#fff' : theme.color} />}
                        <Text style={{ color: active ? '#fff' : theme.color, fontSize: 13, fontWeight: '600' }}>
                            {opt.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}
