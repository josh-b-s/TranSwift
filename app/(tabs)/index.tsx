import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapView, { LatLng, MapPressEvent, Marker, Polyline, PROVIDER_GOOGLE, Region} from 'react-native-maps';
import {ActivityIndicator, Keyboard, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import * as Location from 'expo-location';
import {useSelector} from 'react-redux';
import {RootState} from '@/store/store';
import {BottomSheetModal} from '@gorhom/bottom-sheet';
import {useSharedValue} from 'react-native-reanimated';
import {useColorScheme} from 'nativewind';
import {useIsFocused} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import Search from '@/components/search/Search';
import LocationButton from '@/components/map/LocationButton';
import Speedometer from '@/components/trip/Speedometer';
import RouteBottomSheetModal from '@/components/sheets/RouteBottomSheetModal';
import StopDeparturesSheet from '@/components/sheets/StopDeparturesSheet';
import {StopDots} from '@/components/map/StopDots';
import VehicleMarkers from '@/components/map/VehicleMarkers';
import {useVehicles} from '@/hooks/vehiclePositions';
import {routeKey} from '@/services/gtfs/vehicles/vehicleRoutes';
import MapPickOverlay from '@/components/map/MapPickOverlay';
import DebugMapOverlay from '@/components/debug/DebugMapOverlay';
import DebugControls from '@/components/debug/DebugControls';
import DebugMovementControls from '@/components/debug/DebugMovementControls';
import UserLocationMarker from '@/components/map/UserLocationMarker';
import SimulatedLocationMarker from '@/components/debug/SimulatedLocationMarker';
import {SHADOW, TOP_SAFE, useThemeStyle} from '@/constants/themes';
import {selectDisplayedJourney} from '@/store/route.slice';
import {isCurrentLocation} from '@/services/places/endpoints';
import {useGoToUserLocation} from '../../hooks/goToUserLocation';
import {useFeedSuggestion} from '../../hooks/feedSuggestion';
import {useTripRecorder} from '@/hooks/tripRecorder';
import {useTripNotificationTap} from '@/hooks/tripNotificationTap';
import {useStopsInView} from '@/hooks/stopsInView';
import {useStopColors} from '@/hooks/stopColors';
import {nearestWithin} from '@/services/geo/nearestPoint';
import {getAllStopsCached, type RepoStop} from '@/services/gtfs/core/stopRepo';
import {findRepoStop} from '@/services/gtfs/departures/findRepoStop';
import {getDb} from '@/services/db/sqliteDb';
import type {RouteStop} from '@/services/gtfs/router/routeTypes';
import {RIDE_LINE_WIDTH, RideStopMarkers} from '@/components/map/RideStopMarkers';
import {HIDE_GOOGLE_TRANSIT} from '@/constants/mapStyle';

const EMPTY_COORDS: LatLng[] = [];
// Latitude span the map zooms in to when a stop is tapped, at most.
const STOP_FOCUS_DELTA = 0.008;
// How close to a stop circle a tap counts as hitting it.
const STOP_TAP_RADIUS_DP = 22;
const EMPTY_SEGMENTS: NonNullable<ReturnType<typeof selectDisplayedJourney>>['segments'] = [];

export default function Index() {
    const mapRef = useRef<MapView>(null);
    const modalRef = useRef<BottomSheetModal>(null);
    const departuresRef = useRef<BottomSheetModal>(null);
    const bottomSheetPosition = useSharedValue(1000);
    const {colorScheme} = useColorScheme();
    const theme = useThemeStyle();
    const insets = useSafeAreaInsets();
    const windowHeight = useWindowDimensions().height;

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

    const [region, setRegion] = useState<Region | null>(null);
    // Read by selectStop, which must keep one identity so the stop dots don't re-render on every pan.
    const regionRef = useRef<Region | null>(null);
    const [departureStop, setDepartureStop] = useState<RepoStop | null>(null);
    const [stopRouteKeys, setStopRouteKeys] = useState<string[]>([]);

    // Vehicles on the routes of the open stop and of the shown journey.
    const wantedRouteKeys = useMemo(
        () => [...new Set([...stopRouteKeys, ...(displayedJourney?.legs ?? []).map(l => routeKey(l.routeName, l.routeType))])],
        [stopRouteKeys, displayedJourney],
    );

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

    // Stop dots give way to the route once a place is chosen, and so does the departures sheet.
    const stopsTappable = isFocused && selectedPlace === null && pickingField === null && !debugEnabled;
    const stopsInView = useStopsInView(region, stopsTappable);
    const vehicles = useVehicles(wantedRouteKeys, isFocused && !debugEnabled);
    const stopColors = useStopColors(stopsInView);
    useEffect(() => {
        if (selectedPlace !== null) setDepartureStop(null);
    }, [selectedPlace]);
    // Same handling as the route sheet above: closed, not dismissed, while another tab is showing.
    useEffect(() => {
        if (!isFocused) {
            departuresRef.current?.close({ duration: 0 });
        } else if (departureStop) {
            departuresRef.current?.present();
        } else {
            departuresRef.current?.dismiss();
        }
    }, [isFocused, departureStop]);

    const selectStop = useCallback((stop: RepoStop) => {
        setDepartureStop(stop);
        // Aim a little south of the stop so the sheet doesn't cover it.
        const delta = Math.min(regionRef.current?.latitudeDelta ?? STOP_FOCUS_DELTA, STOP_FOCUS_DELTA);
        mapRef.current?.animateToRegion(
            { latitude: stop.stop_lat - delta * 0.25, longitude: stop.stop_lon, latitudeDelta: delta, longitudeDelta: delta },
            400,
        );
    }, []);

    const selectRouteStop = useCallback(async (routeStop: RouteStop) => {
        const stop = findRepoStop(await getAllStopsCached(await getDb()), routeStop);
        if (stop) selectStop(stop);
    }, [selectStop]);

    const routeStops = useMemo(
        () => (debugEnabled ? [] : routeSegments.flatMap(s => (s.type === 'transit' ? s.stops ?? [] : []))),
        [routeSegments, debugEnabled],
    );

    // Stop circles are not tappable themselves, so a tap on the map opens the nearest one within reach.
    const handleMapPress = (e: MapPressEvent) => {
        Keyboard.dismiss();
        const latitudeDelta = regionRef.current?.latitudeDelta;
        if (!latitudeDelta) return;
        const point = e.nativeEvent.coordinate;
        const reach = (latitudeDelta * STOP_TAP_RADIUS_DP) / windowHeight;
        const routeStop = nearestWithin(routeStops, point, reach, s => s);
        if (routeStop) {
            selectRouteStop(routeStop);
            return;
        }
        const stop = nearestWithin(stopsInView, point, reach, s => ({latitude: s.stop_lat, longitude: s.stop_lon}));
        if (stop) selectStop(stop);
    };

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
                showsMyLocationButton={false}
                showsCompass={false}
                userInterfaceStyle={colorScheme ?? 'light'}
                customMapStyle={HIDE_GOOGLE_TRANSIT}
                showsPointsOfInterest={false}
                // With the POI listener on, Android sends taps on a Google icon to onPoiClick and never calls onPress.
                poiClickEnabled={false}
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
                onPress={handleMapPress}
                onRegionChangeComplete={r => {
                    regionRef.current = r;
                    setRegion(r);
                }}
            >
                {!debugEnabled && (routeSegments.length > 0 ? (
                    routeSegments.map((segment, index) => (
                        <Polyline
                            key={index}
                            coordinates={segment.coords}
                            strokeWidth={segment.type === 'walk' ? 4 : RIDE_LINE_WIDTH}
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

                {!debugEnabled && routeSegments.map((segment, index) => segment.type === 'transit' && (
                    <RideStopMarkers key={index} segment={segment} color={segment.routeColor ?? routeColor ?? '#2563eb'} />
                ))}

                <StopDots stops={stopsInView} colors={stopColors} />
                <VehicleMarkers vehicles={vehicles} center={region} />

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

                <UserLocationMarker/>
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
            <StopDeparturesSheet
                ref={departuresRef}
                stop={departureStop}
                animatedPosition={bottomSheetPosition}
                onClose={() => setDepartureStop(null)}
                onRoutes={setStopRouteKeys}
            />
        </View>
    );
}