import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { ArrowUpDown, MapPin, Navigation } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import {
    clearResults, searchPlaces, selectPlace, setOrigin, setQuery, startPicking, swapEndpoints,
    type RouteField,
} from '@/store/search.slice';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ACCENT, SHADOW, TOP_SAFE, useThemeStyle } from '@/constants/themes';
import { clearRoute } from '@/store/route.slice';
import { useRequestRoute } from '@/hooks/requestRoute';
import { CURRENT_LOCATION, isCurrentLocation } from '@/services/places/endpoints';
import type { SearchPlace } from '@/services/places/places';
import EndpointField from '@/components/search/EndpointField';

const GOOGLE_MAPS_APIKEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

export default function Search() {
    const dispatch = useDispatch<AppDispatch>();
    const { query, results, showResults, loading, origin, selected: destination } = useSelector((s: RootState) => s.search);
    const userLocation = useSelector((s: RootState) => s.location.userLocation);
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
        if (field === 'origin') {
            dispatch(setOrigin(place));
            requestRoute({ origin: place });
        } else {
            dispatch(selectPlace(place));
            requestRoute({ destination: place });
        }
    }, [dispatch, requestRoute, resetTyping, activeField]);

    // "Current location" is offered on an empty field, unless it would put the
    // same point at both ends.
    const ownPlace = activeField === 'origin' ? origin : destination;
    const otherPlace = activeField === 'origin' ? destination : origin;
    const offerCurrent = activeField !== null
        && query.trim() === ''
        && !(ownPlace && isCurrentLocation(ownPlace))
        && !(otherPlace && isCurrentLocation(otherPlace));
    const dropdownData: SearchPlace[] = offerCurrent
        ? [CURRENT_LOCATION]
        : (activeField && showResults ? results : []);

    return (
        <View className="absolute left-4 right-4 z-[9999]" style={{ top: topInset }}>
            <View className="flex-row items-center rounded-3xl pl-3 pr-1 py-1"
                  style={[{ backgroundColor: theme.backgroundColor }, SHADOW]}>
                <View style={{ flex: 1 }}>
                    <EndpointField
                        field="origin"
                        value={activeField === 'origin' ? query : origin.name}
                        placeholder={activeField === 'origin' ? origin.name : 'Starting point'}
                        onFocus={() => focusField('origin')}
                        onChangeText={(t) => dispatch(setQuery(t))}
                        onPickOnMap={() => pickOnMap('origin')}
                        onClear={isCurrentLocation(origin) ? undefined : resetOrigin}
                    />
                    <View style={{ height: 1, marginLeft: 30, backgroundColor: theme.color + '14' }} />
                    <EndpointField
                        field="destination"
                        value={activeField === 'destination' ? query : destination?.name ?? ''}
                        placeholder={activeField === 'destination' && destination ? destination.name : 'Where to?'}
                        loading={loading}
                        onFocus={() => focusField('destination')}
                        onChangeText={(t) => dispatch(setQuery(t))}
                        onPickOnMap={() => pickOnMap('destination')}
                        onClear={destination ? clearDestination : undefined}
                    />
                </View>
                <Pressable
                    onPress={swap}
                    disabled={!destination}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Swap start and destination"
                    style={{ padding: 10, opacity: destination ? 1 : 0.3 }}
                >
                    <ArrowUpDown size={20} color={theme.color} />
                </Pressable>
            </View>

            {dropdownData.length > 0 && (
                <View className="rounded-3xl overflow-hidden mt-2" style={[{ backgroundColor: theme.backgroundColor }, SHADOW]}>
                    <FlatList
                        data={dropdownData}
                        keyExtractor={(i) => i.place_id}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item, index }) => {
                            const current = isCurrentLocation(item);
                            const Icon = current ? Navigation : MapPin;
                            return (
                                <TouchableOpacity
                                    onPress={() => onSelect(item)}
                                    accessibilityRole="button"
                                    accessibilityLabel={current ? item.name : `${item.name}, ${item.address}`}
                                    className="flex-row items-center px-4 py-3"
                                    style={index < dropdownData.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.color + '14' } : undefined}
                                >
                                    <View
                                        className="items-center justify-center rounded-full mr-3"
                                        style={{ width: 36, height: 36, backgroundColor: ACCENT + '1f' }}
                                    >
                                        <Icon size={18} color={ACCENT} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-base font-semibold" numberOfLines={1} style={{ color: theme.color }}>{item.name}</Text>
                                        {!current && (
                                            <Text className="text-sm mt-0.5" numberOfLines={1} style={{ color: theme.color, opacity: 0.55 }}>{item.address}</Text>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        }}
                    />
                </View>
            )}
        </View>
    );
}
