import React, { useEffect, useRef } from 'react';
import MapView, { LatLng, Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import {ActivityIndicator, Keyboard, StyleSheet, Text, View} from 'react-native';
import * as Location from 'expo-location';
import {useSelector} from 'react-redux';
import {RootState} from '@/store/store';
import {BottomSheetModal} from '@gorhom/bottom-sheet';
import {useSharedValue} from 'react-native-reanimated';
import {useColorScheme} from 'nativewind';
import {useIsFocused} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import Search from '@/components/Search';
import LocationButton from '@/components/LocationButton';
import Speedometer from '@/components/Speedometer';
import RouteBottomSheetModal from '@/components/RouteBottomSheetModal';
import MapPickOverlay from '@/components/MapPickOverlay';
import DebugMapOverlay from '@/components/DebugMapOverlay';
import DebugControls from '@/components/DebugControls';
import DebugMovementControls from '@/components/DebugMovementControls';
import SimulatedLocationMarker from '@/components/SimulatedLocationMarker';
import {MAP_STYLE_DARK, SHADOW, TOP_SAFE, useThemeStyle} from '@/constants/themes';
import {selectDisplayedJourney} from '@/store/route.slice';
import {isCurrentLocation} from '@/services/places/endpoints';
import {useGoToUserLocation} from '../../hooks/goToUserLocation';
import {useFeedSuggestion} from '../../hooks/feedSuggestion';
import {useTripRecorder} from '@/hooks/tripRecorder';
import {useTripNotificationTap} from '@/hooks/tripNotificationTap';

const EMPTY_COORDS: LatLng[] = [];
const EMPTY_SEGMENTS: NonNullable<ReturnType<typeof selectDisplayedJourney>>['segments'] = [];

export default function Index() {
    const mapRef = useRef<MapView>(null);
    const modalRef = useRef<BottomSheetModal>(null);
    const bottomSheetPosition = useSharedValue(1000);
    const {colorScheme} = useColorScheme();
    const theme = useThemeStyle();
    const insets = useSafeAreaInsets();

    const userLocation = useSelector((s: RootState) => s.location.userLocation);
    const displayedJourney = useSelector(selectDisplayedJourney);
    // Module-level empties keep these reference-stable when there's no
    // journey (the fit-to-route effect depends on routeCoords' identity).
    const routeCoords = displayedJourney?.coords ?? EMPTY_COORDS;
    const routeSegments = displayedJourney?.segments ?? EMPTY_SEGMENTS;
    const routeColor = displayedJourney?.routeColor;
    const routeLoading = useSelector((s: RootState) => s.route.loading);
    const selectedPlace = useSelector((s: RootState) => s.search.selected);
    const origin = useSelector((s: RootState) => s.search.origin);
    const pickingField = useSelector((s: RootState) => s.search.pickingField);
    const debugEnabled = useSelector((s: RootState) => s.debug.enabled);

    const goToUserLocation = useGoToUserLocation(mapRef);
    useFeedSuggestion();
    useTripRecorder();
    useTripNotificationTap();

    // The sheet is a root-level portal (mounted by BottomSheetModalProvider
    // above the tab navigator), so switching tabs doesn't hide it on its
    // own. Close it (not dismiss — dismiss unmounts it, and it wouldn't
    // come back on its own) when this screen loses focus, and bring it
    // back when returning here, but only if there's actually a place/route
    // to show it for. Closing uses duration 0 — by the time this runs the
    // Settings screen is already on screen, so an animated slide-down would
    // visibly play over it instead of on the map.
    const isFocused = useIsFocused();
    // Hidden while choosing a point on the map, so it doesn't cover the map.
    const showSheet = selectedPlace !== null && pickingField === null;
    useEffect(() => {
        if (isFocused) {
            if (showSheet) {
                modalRef.current?.present();
            } else {
                // Closing the sheet's header X clears the place; take the sheet down with it.
                modalRef.current?.dismiss();
            }
        } else {
            modalRef.current?.close({ duration: 0 });
        }
    }, [isFocused, showSheet]);

    useEffect(() => {
        goToUserLocation();
    }, [goToUserLocation]);

    useEffect(() => {
        if (!routeCoords?.length) return;

        if (routeCoords.length > 1) {
            mapRef.current?.fitToCoordinates(routeCoords, {
                edgePadding: {top: 80, right: 60, bottom: 300, left: 60},
                animated: true,
            });
        } else {
            const p = routeCoords[0];
            mapRef.current?.animateToRegion(
                {
                    latitude: p.latitude,
                    longitude: p.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                },
                700,
            );
        }
    }, [routeCoords]);

    return (
        <View style={{flex: 1}}>
            {pickingField === null && <Search/>}

            <MapView
                ref={mapRef}
                key={colorScheme}
                style={StyleSheet.absoluteFillObject}
                showsUserLocation
                showsMyLocationButton={false}
                showsCompass={false}
                userInterfaceStyle={colorScheme ?? 'light'}
                customMapStyle={colorScheme === 'dark' ? MAP_STYLE_DARK : []}
                onMapReady={() => {
                    if (userLocation) {
                        mapRef.current?.animateToRegion(
                            {
                                ...userLocation,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01,
                            },
                            700,
                        );
                    }
                }}
                onPress={() => Keyboard.dismiss()}
            >
                {!debugEnabled && (routeSegments.length > 0 ? (
                    routeSegments.map((segment, index) => (
                        <Polyline
                            key={index}
                            coordinates={segment.coords}
                            strokeWidth={segment.type === 'walk' ? 3 : 5}
                            strokeColor={segment.routeColor ?? routeColor ?? '#2563eb'}
                            lineDashPattern={segment.type === 'walk' ? [8, 8] : undefined}
                            lineCap="round"
                            lineJoin="round"
                            geodesic={false}
                        />
                    ))
                )  : routeCoords.length > 0 ? (
                    <Polyline
                        coordinates={routeCoords}
                        strokeWidth={4}
                        strokeColor={routeColor ?? '#2563eb'}
                    />
                ) : null)}

                {!isCurrentLocation(origin) && (
                    <Marker
                        coordinate={{latitude: origin.latitude, longitude: origin.longitude}}
                        title={origin.name}
                        pinColor="green"
                    />
                )}
                {selectedPlace && !isCurrentLocation(selectedPlace) && (
                    <Marker
                        coordinate={{latitude: selectedPlace.latitude, longitude: selectedPlace.longitude}}
                        title={selectedPlace.name}
                    />
                )}

                {__DEV__ && <SimulatedLocationMarker/>}
                {/*<DebugMapOverlay />*/}
            </MapView>

            {routeLoading && (
                // A small floating pill instead of a full-screen dim+spinner —
                // the search bar's own spinner already signals place
                // lookups, so a second full-screen treatment for route
                // computation felt heavier than the wait usually warrants.
                <View
                    style={{
                        position: 'absolute',
                        top: TOP_SAFE(insets) + 120,
                        left: 0,
                        right: 0,
                        alignItems: 'center',
                    }}
                    pointerEvents="none"
                >
                    <View
                        style={[
                            {
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                                backgroundColor: theme.backgroundColor,
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 999,
                            },
                            SHADOW,
                        ]}
                    >
                        <ActivityIndicator size="small" color="#2563eb" />
                        <Text style={{ color: theme.color, fontSize: 13, fontWeight: '600' }}>
                            Finding your route…
                        </Text>
                    </View>
                </View>
            )}

            <MapPickOverlay mapRef={mapRef} />
            <Speedometer animatedPosition={bottomSheetPosition} />
            <LocationButton mapRef={mapRef} animatedPosition={bottomSheetPosition} />
            {/*<DebugControls />*/}
            {__DEV__ && <DebugMovementControls mapRef={mapRef} animatedPosition={bottomSheetPosition}/>}
            <RouteBottomSheetModal ref={modalRef} animatedPosition={bottomSheetPosition} />
        </View>
    );
}