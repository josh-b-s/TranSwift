import React from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { CircleX, Circle, Crosshair, MapPin, Search } from 'lucide-react-native';
import { ACCENT, DANGER, useThemeStyle } from '@/constants/themes';
import type { RouteField } from '@/store/search.slice';

type Props = {
    field: RouteField;
    /** What the input shows: the typed query while active, otherwise the chosen place's name. */
    value: string;
    placeholder: string;
    loading?: boolean;
    /** The lone "Where to?" bar, before anything is chosen: a search icon instead of the destination pin. */
    idle?: boolean;
    onFocus: () => void;
    onChangeText: (text: string) => void;
    onPickOnMap: () => void;
    onClear?: () => void;
};

const FIELD_LABEL: Record<RouteField, string> = { origin: 'start', destination: 'destination' };

export default function EndpointField({
    field, value, placeholder, loading, idle, onFocus, onChangeText, onPickOnMap, onClear,
}: Props) {
    const theme = useThemeStyle();

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 46 }}>
            <View style={{ width: 22, alignItems: 'center' }}>
                {field === 'origin'
                    ? <Circle size={12} color={ACCENT} strokeWidth={3} />
                    : idle
                        ? <Search size={20} color={theme.muted} />
                        : <MapPin size={18} color={DANGER} />}
            </View>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                onFocus={onFocus}
                selectTextOnFocus
                placeholder={placeholder}
                placeholderTextColor={idle ? theme.muted : theme.color + '80'}
                returnKeyType="search"
                style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: idle ? 17 : 16, fontWeight: idle ? '500' : '400', color: theme.color }}
            />
            {loading && <ActivityIndicator size="small" color={ACCENT} style={{ marginHorizontal: 4 }} />}
            {onClear && (
                <Pressable
                    onPress={onClear}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Clear ${FIELD_LABEL[field]}`}
                    style={{ padding: 6 }}
                >
                    <CircleX size={20} color={theme.color} style={{ opacity: 0.4 }} />
                </Pressable>
            )}
            <Pressable
                onPress={onPickOnMap}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Choose ${FIELD_LABEL[field]} on map`}
                style={{ padding: 6 }}
            >
                <Crosshair size={20} color={theme.color} style={{ opacity: 0.6 }} />
            </Pressable>
        </View>
    );
}
