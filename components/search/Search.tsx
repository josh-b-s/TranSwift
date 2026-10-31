import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { ArrowUpDown, Clock, MapPin, Navigation, Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import {
    clearResults, searchPlaces, selectPlace, setOrigin, setQuery, startPicking, swapEndpoints,
    type RouteField,
} from '@/store/search.slice';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ACCENT, RADIUS, SHADOW, TOP_SAFE, useThemeStyle } from '@/constants/themes';
import { clearRoute } from '@/store/route.slice';
import { useRequestRoute } from '@/hooks/requestRoute';
import { CURRENT_LOCATION, isCurrentLocation } from '@/services/places/endpoints';
import type { SearchPlace } from '@/services/places/places';
import EndpointField from '@/components/search/EndpointField';
import { addRecentPlace } from '@/store/savedPlaces.slice';
import { buildSuggestions, isRecent, isSaved, matchPlaces, mergeResults } from '@/services/places/savedPlaces';

// How long the start row takes to appear or go.
const OPEN_MS = 200;
const GOOGLE_MAPS_APIKEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

export default function Search() {
    const dispatch = useDispatch<AppDispatch>();
    const { query, results, showResults, loading, origin, selected: destination } = useSelector((s: RootState) => s.search);
    const userLocation = useSelector((s: RootState) => s.location.userLocation);
    const { saved, recents } = useSelector((s: RootState) => s.savedPlaces);
    const requestRoute = useRequestRoute();
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const theme = useThemeStyle();
    const topInset = TOP_SAFE(useSafeAreaInsets());
    // Which field the typed query belongs to. Null once a result is picked.
    const [activeField, setActiveField] = useState<RouteField | null>(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!query || query.trim().length < 3) { dispatch(clearResults()); return; }

        debounceRef.current = setTimeout(() => {
            dispatch(searchPlaces({ query, location: userLocation ?? undefined, apiKey: GOOGLE_MAPS_APIKEY }));
        }, 300);

        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [query, userLocation, dispatch]);

    const resetTyping = useCallback(() => {
        dispatch(setQuery(''));
        dispatch(clearResults());
    }, [dispatch]);

    const focusField = useCallback((field: RouteField) => {
        setActiveField(field);
        resetTyping();
    }, [resetTyping]);

    const pickOnMap = useCallback((field: RouteField) => {
        Keyboard.dismiss();
        setActiveField(null);
        resetTyping();
        dispatch(startPicking(field));
    }, [dispatch, resetTyping]);

    const clearDestination = useCallback(() => {
        Keyboard.dismiss();
        setActiveField(null);
        resetTyping();
        dispatch(selectPlace(null));
        dispatch(clearRoute());
    }, [dispatch, resetTyping]);

    const resetOrigin = useCallback(() => {
        Keyboard.dismiss();
        setActiveField(null);
        resetTyping();
        dispatch(setOrigin(CURRENT_LOCATION));
        requestRoute({ origin: CURRENT_LOCATION });
    }, [dispatch, resetTyping, requestRoute]);

    const swap = useCallback(() => {
        if (!destination) return;
        Haptics.selectionAsync();
        dispatch(swapEndpoints());
        requestRoute({ origin: destination, destination: origin });
    }, [dispatch, requestRoute, destination, origin]);

    const onSelect = useCallback((place: SearchPlace) => {
        const field = activeField ?? 'destination';
        Keyboard.dismiss();
        setActiveField(null);
        resetTyping();
        if (!isCurrentLocation(place)) dispatch(addRecentPlace(place));
        if (field === 'origin') {
            dispatch(setOrigin(place));
            requestRoute({ origin: place });
        } else {
            dispatch(selectPlace(place));
            requestRoute({ destination: place });
        }
    }, [dispatch, requestRoute, resetTyping, activeField]);

    // An empty field offers "Current location", saved places and recent searches. Neither end is offered if it
    // would put the same point at both.
    const ownPlace = activeField === 'origin' ? origin : destination;
    const otherPlace = activeField === 'origin' ? destination : origin;
    const emptyField = activeField !== null && query.trim() === '';
    const offerCurrent = emptyField
        && !(ownPlace && isCurrentLocation(ownPlace))
        && !(otherPlace && isCurrentLocation(otherPlace));
    const dropdownData: SearchPlace[] = emptyField
        ? [
            ...(offerCurrent ? [CURRENT_LOCATION] : []),
            ...buildSuggestions(saved, recents, otherPlace?.place_id),
        ]
        : activeField ? mergeResults(matchPlaces(saved, recents, query), showResults ? results : []) : [];

    // Until a destination or start is chosen, only a single "Where to?" bar shows. The destination field stays
    // mounted across the change (it holds the keyboard focus), so the start row is the only thing that comes and goes.
    const expanded = activeField !== null || destination !== null || !isCurrentLocation(origin);

    return (
        <View style={{ position: 'absolute', left: 16, right: 16, zIndex: 9999, top: topInset }}>
            <Animated.View
                layout={LinearTransition.duration(OPEN_MS)}
                style={[
                    {
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderRadius: expanded ? RADIUS.card + 4 : 28,
                        paddingLeft: 12,
                        paddingRight: 4,
                        paddingVertical: 4,
                        backgroundColor: theme.backgroundColor,
                    },
                    SHADOW,
                ]}
            >
                <View style={{ flex: 1 }}>
                    {expanded && (
                        <Animated.View entering={FadeIn.duration(OPEN_MS)} exiting={FadeOut.duration(OPEN_MS / 2)}>
                            <EndpointField
                                field="origin"
                                value={activeField === 'origin' ? query : origin.name}
                                placeholder={activeField === 'origin' ? origin.name : 'Starting point'}
                                onFocus={() => focusField('origin')}
                                onChangeText={(t) => dispatch(setQuery(t))}
                                onPickOnMap={() => pickOnMap('origin')}
                                onClear={isCurrentLocation(origin) ? undefined : resetOrigin}
                            />
                            <View style={{ height: 1, marginLeft: 30, backgroundColor: theme.hairline }} />
                        </Animated.View>
                    )}
                    <EndpointField
                        field="destination"
                        idle={!expanded}
                        value={activeField === 'destination' ? query : destination?.name ?? ''}
                        placeholder={activeField === 'destination' && destination ? destination.name : 'Where to?'}
                        loading={loading}
                        onFocus={() => focusField('destination')}
                        onChangeText={(t) => dispatch(setQuery(t))}
                        onPickOnMap={() => pickOnMap('destination')}
                        onClear={destination ? clearDestination : undefined}
                    />
                    {expanded && <RouteConnector color={theme.color + '40'} />}
                </View>
                {expanded && (
                    <Pressable
                        onPress={swap}
                        disabled={!destination}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel="Swap start and destination"
                        style={{
                            width: 40, height: 40, borderRadius: 20, marginLeft: 4,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: theme.hairline,
                            opacity: destination ? 1 : 0.35,
                        }}
                    >
                        <ArrowUpDown size={18} color={theme.color} />
                    </Pressable>
                )}
            </Animated.View>

            {dropdownData.length > 0 && (
                <View style={[{ borderRadius: RADIUS.card + 4, overflow: 'hidden', marginTop: 8, backgroundColor: theme.backgroundColor }, SHADOW]}>
                    <FlatList
                        data={dropdownData}
                        style={{ maxHeight: 360 }}
                        keyExtractor={(i) => i.place_id}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => {
                            const current = isCurrentLocation(item);
                            const Icon = current ? Navigation : isSaved(saved, item.place_id) ? Star : emptyField || isRecent(recents, item.place_id) ? Clock : MapPin;
                            return (
                                <TouchableOpacity
                                    onPress={() => onSelect(item)}
                                    accessibilityRole="button"
                                    accessibilityLabel={current ? item.name : `${item.name}, ${item.address}`}
                                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}
                                >
                                    <View
                                        style={{
                                            width: 36, height: 36, borderRadius: 18, marginRight: 12,
                                            alignItems: 'center', justifyContent: 'center',
                                            backgroundColor: theme.accentSoft,
                                        }}
                                    >
                                        <Icon size={18} color={ACCENT} fill={Icon === Star ? ACCENT : 'none'} />
                                    </View>
                                    <View style={{ flex: 1, paddingVertical: 2 }}>
                                        <Text numberOfLines={1} style={{ color: theme.color, fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
                                        {!current && !!item.address && (
                                            <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 13, marginTop: 1 }}>{item.address}</Text>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        }}
                        // Rule starts at the text, not under the icon.
                        ItemSeparatorComponent={() => <View style={{ height: 1, marginLeft: 64, backgroundColor: theme.hairline }} />}
                    />
                </View>
            )}
        </View>
    );
}

// Three dots down the gutter between the start ring and the destination pin.
const CONNECTOR_DOT = 3;
function RouteConnector({ color }: { color: string }) {
    return (
        <Animated.View entering={FadeIn.duration(OPEN_MS)} pointerEvents="none" style={{ position: 'absolute', left: 10, top: 35, gap: 5 }}>
            {[0, 1, 2].map(i => (
                <View key={i} style={{ width: CONNECTOR_DOT, height: CONNECTOR_DOT, borderRadius: 2, backgroundColor: color }} />
            ))}
        </Animated.View>
    );
}
