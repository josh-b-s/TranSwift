import React from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Star, Trash2 } from 'lucide-react-native';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { ACCENT, DANGER, RADIUS, useThemeStyle } from '@/constants/themes';
import { renameSavedPlace, toggleSavedPlace } from '@/store/savedPlaces.slice';
import type { SavedPlace } from '@/services/places/savedPlaces';

export default function SavedPlaces() {
    const theme = useThemeStyle();
    const dispatch = useDispatch<AppDispatch>();
    const saved = useSelector((s: RootState) => s.savedPlaces.saved);

    function confirmRemove(place: SavedPlace) {
        Alert.alert(`Remove ${place.label}?`, undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => dispatch(toggleSavedPlace(place)) },
        ]);
    }

    return (
        <ScrollView style={{ flex: 1, backgroundColor: theme.surfaceColor }} contentContainerStyle={{ padding: 16, gap: 8 }}>
            <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 18, marginBottom: 4, paddingHorizontal: 4 }}>
                Star a place or stop on its sheet to save it. Rename one to "Home" or "Work" here. Saved places show up when you tap an empty start or destination field.
            </Text>

            {saved.length === 0 && (
                <Text style={{ color: theme.muted, fontSize: 14, textAlign: 'center', padding: 24 }}>
                    No saved places yet.
                </Text>
            )}

            {saved.map(place => (
                <View
                    key={place.place_id}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        padding: 14,
                        borderRadius: RADIUS.tile,
                        backgroundColor: theme.backgroundColor,
                    }}
                >
                    <Star size={20} color={ACCENT} fill={ACCENT} />
                    <View style={{ flex: 1 }}>
                        <TextInput
                            defaultValue={place.label}
                            onEndEditing={e => dispatch(renameSavedPlace({ placeId: place.place_id, label: e.nativeEvent.text }))}
                            accessibilityLabel={`Name for ${place.name}`}
                            style={{ color: theme.color, fontSize: 15, fontWeight: '600', paddingVertical: 2 }}
                        />
                        <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 12 }}>
                            {place.address || place.name}
                        </Text>
                    </View>
                    <Pressable
                        onPress={() => confirmRemove(place)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${place.label}`}
                        style={{ padding: 4 }}
                    >
                        <Trash2 size={18} color={DANGER} />
                    </Pressable>
                </View>
            ))}
        </ScrollView>
    );
}
