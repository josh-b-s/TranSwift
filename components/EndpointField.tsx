import React from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { CircleX, Circle, Crosshair, MapPin } from 'lucide-react-native';
import { ACCENT, useThemeStyle } from '@/constants/themes';
import type { RouteField } from '@/store/search.slice';

type Props = {
    field: RouteField;
    /** What the input shows: the typed query while active, otherwise the chosen place's name. */
    value: string;
    placeholder: string;
    loading?: boolean;
    onFocus: () => void;
    onChangeText: (text: string) => void;
    onPickOnMap: () => void;
    onClear?: () => void;
};

const FIELD_LABEL: Record<RouteField, string> = { origin: 'start', destination: 'destination' };

export default function EndpointField({
    field, value, placeholder, loading, onFocus, onChangeText, onPickOnMap, onClear,
}: Props) {
    const theme = useThemeStyle();

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 46 }}>
            <View style={{ width: 22, alignItems: 'center' }}>
                {field === 'origin'
                    ? <Circle size={12} color={ACCENT} strokeWidth={3} />
                    : <MapPin size={18} color="#ef4444" />}
            </View>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                onFocus={onFocus}
                selectTextOnFocus
                placeholder={placeholder}
                placeholderTextColor={theme.color + '80'}
                returnKeyType="search"
                style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 16, color: theme.color }}
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
