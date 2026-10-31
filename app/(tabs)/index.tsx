import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapView, { LatLng, MapPressEvent, Polyline, PROVIDER_GOOGLE, Region} from 'react-native-maps';
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
import TripPathOverlay from '@/components/map/TripPathOverlay';
import {useVehicles} from '@/hooks/vehiclePositions';
import {type TripFocus, useTripPath} from '@/hooks/tripPath';
import {useLineKeys} from '@/hooks/lineKeys';
import {isZoomedIn} from '@/services/geo/zoom';
import {type MapVehicle, routeKey} from '@/services/gtfs/vehicles/vehicleRoutes';
import {visibleVehicles} from '@/services/gtfs/vehicles/visibleVehicles';
import MapPickOverlay from '@/components/map/MapPickOverlay';
import DebugMapOverlay from '@/components/debug/DebugMapOverlay';
import DebugControls from '@/components/debug/DebugControls';
import DebugMovementControls from '@/components/debug/DebugMovementControls';
import UserLocationMarker from '@/components/map/UserLocationMarker';
import SimulatedLocationMarker from '@/components/debug/SimulatedLocationMarker';
import {ACCENT, SHADOW, TOP_SAFE, useThemeStyle} from '@/constants/themes';
import {selectDisplayedJourney} from '@/store/route.slice';
import {isCurrentLocation} from '@/services/places/endpoints';
import {useGoToUserLocation} from '../../hooks/goToUserLocation';
import {useFeedSuggestion} from '../../hooks/feedSuggestion';
import {useRealtimeAuthAlert} from '@/hooks/realtimeAuthAlert';
import {useTripRecorder} from '@/hooks/tripRecorder';
import {useTripNotificationTap} from '@/hooks/tripNotificationTap';
import {useAutoStartTrip} from '@/hooks/autoStartTrip';
import {useMapFollow} from '@/hooks/mapFollow';
import {useUserPosition} from '@/hooks/userPosition';
import {useCompassHeading} from '@/hooks/compassHeading';
import {useSimulation} from '@/hooks/simulation';
import {useStopsInView} from '@/hooks/stopsInView';
import {useStopColors} from '@/hooks/stopColors';
import {nearestWithin} from '@/services/geo/nearestPoint';
import {getAllStopsCached, type RepoStop} from '@/services/gtfs/core/stopRepo';
import {findRepoStop} from '@/services/gtfs/departures/findRepoStop';
import {getDb} from '@/services/db/sqliteDb';
import type {RouteStop} from '@/services/gtfs/router/routeTypes';
import {RIDE_LINE_WIDTH, RideStopMarkers} from '@/components/map/RideStopMarkers';
import {HIDE_GOOGLE_TRANSIT} from '@/constants/mapStyle';
import {darken} from '@/services/color/darken';
import PlaceMarker from '@/components/map/PlaceMarker';
import {DESTINATION_PIN_COLOR, ORIGIN_PIN_COLOR} from '@/components/map/PlacePin';

// How much darker than the route colour its outline is.
const CASING_DARKEN = 0.4;
const EMPTY_COORDS: LatLng[] = [];
// Latitude span the map zooms in to when a stop is tapped, at most.
const STOP_FOCUS_DELTA = 0.008;
// How close to a stop circle a tap counts as hitting it.
const STOP_TAP_RADIUS_DP = 22;
// Room left around a route fitted on screen, mostly at the bottom for the sheet.
const ROUTE_FIT_PADDING = {top: 80, right: 60, bottom: 300, left: 60};
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
    // The departures sheet at its lowest snap point: the stop is out of focus, so its vehicles go.
    const [departuresLowered, setDeparturesLowered] = useState(false);
    // The trip whose whole line and stops are drawn, and whose vehicle is highlighted.
    const [tripFocus, setTripFocus] = useState<TripFocus | null>(null);
    const tripPath = useTripPath(tripFocus?.trip ?? null);

    // Vehicles on the routes of the open stop, of the shown trip and of the shown journey.
    const wantedRouteKeys = useMemo(
        () => [...new Set([
            ...(departuresLowered ? [] : stopRouteKeys),
            ...(tripFocus ? [tripFocus.routeKey] : []),
            ...(displayedJourney?.legs ?? []).map(l => routeKey(l.routeName, l.routeType)),
        ])],
        [stopRouteKeys, departuresLowered, tripFocus, displayedJourney],
    );

    const goToUserLocation = useGoToUserLocation(mapRef);
    useFeedSuggestion();
    useRealtimeAuthAlert();
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

    const position = useUserPosition(isFocused);
    const compass = useCompassHeading(isFocused);
    // A simulated fix is exact, and the simulator stands in for both the position and the compass.
    const simulation = useSimulation();
    const here = useMemo(() => (simulation ? {...simulation.position, accuracyM: 0} : position), [simulation, position]);
    const follow = useMapFollow(mapRef, here, simulation ? simulation.headingDeg : compass?.degrees ?? null);
    useAutoStartTrip(here);
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
    const vehicleScope = useSelector((s: RootState) => s.preferences.vehicleScope);
    const zoomedIn = isZoomedIn(region);
    const showAllVehicles = vehicleScope === 'nearby' && zoomedIn;
    const vehicles = useVehicles(wantedRouteKeys, isFocused && !debugEnabled, showAllVehicles);
    const focusedTripId = tripPath?.tripId ?? null;
    const lineTripIds = useMemo(
        () => (focusedTripId === null ? [] : [...new Set([focusedTripId, ...vehicles.flatMap(v => (v.tripId ? [v.tripId] : []))])]),
        [focusedTripId, vehicles],
    );
    const lineKeys = useLineKeys(lineTripIds);
    const drawnVehicles = useMemo(
        () => visibleVehicles(vehicles, zoomedIn, focusedTripId === null ? null : {tripId: focusedTripId, lineKeys}),
        [vehicles, zoomedIn, focusedTripId, lineKeys],
    );
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
        follow.release();
        setDepartureStop(stop);
        setTripFocus(null);
        // A stop picked while the sheet is lowered brings it back up.
        departuresRef.current?.snapToIndex(1);
        // Aim a little south of the stop so the sheet doesn't cover it.
        const delta = Math.min(regionRef.current?.latitudeDelta ?? STOP_FOCUS_DELTA, STOP_FOCUS_DELTA);
        mapRef.current?.animateToRegion(
            { latitude: stop.stop_lat - delta * 0.25, longitude: stop.stop_lon, latitudeDelta: delta, longitudeDelta: delta },
            400,
        );
    }, [follow.release]);

    const selectRouteStop = useCallback(async (routeStop: RouteStop) => {
        const stop = findRepoStop(await getAllStopsCached(await getDb()), routeStop);
        if (stop) selectStop(stop);
    }, [selectStop]);

    // A second tap on the same vehicle puts the line away. A vehicle that reports no trip cannot be traced to a line.
    const selectVehicle = useCallback((vehicle: MapVehicle) => {
        const tripId = vehicle.tripId;
        if (!tripId) return;
        setTripFocus(current => (current && 'tripId' in current.trip && current.trip.tripId === tripId ? null : {trip: {tripId}, color: vehicle.color, routeKey: routeKey(vehicle.routeName, vehicle.routeType)}));
    }, []);

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
        else setTripFocus(null);
    };

    useEffect(() => {
        goToUserLocation();
    }, [goToUserLocation]);

    useEffect(() => {
        if (!routeCoords?.length) return;
        follow.release();

        if (routeCoords.length > 1) {
            mapRef.current?.fitToCoordinates(routeCoords, {
                edgePadding: ROUTE_FIT_PADDING,
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
    }, [routeCoords, follow.release]);

    useEffect(() => {
        if (!tripPath || tripPath.line.length < 2) return;
        follow.release();
        mapRef.current?.fitToCoordinates(tripPath.line, {edgePadding: ROUTE_FIT_PADDING, animated: true});
    }, [tripPath, follow.release]);

    useEffect(() => {
        if (pickingField !== null) follow.release();
    }, [pickingField, follow.release]);

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
                onPanDrag={follow.release}
                mapPadding={follow.mapPadding}
                onRegionChangeComplete={r => {
                    regionRef.current = r;
                    setRegion(r);
                }}
            >
                {/* A darker shade of the route colour under each ride, as an outline. */}
                {!debugEnabled && routeSegments.map((segment, index) => segment.type === 'transit' && (
                    <Polyline
                        key={`casing-${index}`}
                        coordinates={segment.coords}
                        strokeWidth={RIDE_LINE_WIDTH + 4}
                        strokeColor={darken(segment.routeColor ?? routeColor ?? ACCENT, CASING_DARKEN)}
                        lineCap="round"
                        lineJoin="round"
                        geodesic={false}
                    />
                ))}

                {!debugEnabled && (routeSegments.length > 0 ? (
                    routeSegments.map((segment, index) => (
                        <Polyline
                            key={index}
                            coordinates={segment.coords}
                            strokeWidth={segment.type === 'walk' ? 4 : RIDE_LINE_WIDTH}
                            strokeColor={segment.routeColor ?? routeColor ?? ACCENT}
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
                        strokeColor={routeColor ?? ACCENT}
                    />
                ) : null)}

                {!debugEnabled && routeSegments.map((segment, index) => segment.type === 'transit' && (
                    <RideStopMarkers key={index} segment={segment} color={segment.routeColor ?? routeColor ?? '#2563eb'} />
                ))}

                {!debugEnabled && tripPath && tripFocus && <TripPathOverlay path={tripPath} color={tripFocus.color} />}

                <StopDots stops={stopsInView} colors={stopColors} />
                <VehicleMarkers vehicles={drawnVehicles} center={region} selectedTripId={focusedTripId} onPress={selectVehicle} />

                {!isCurrentLocation(origin) && (
                    <PlaceMarker latitude={origin.latitude} longitude={origin.longitude} color={ORIGIN_PIN_COLOR} title={origin.name} />
                )}
                {selectedPlace && !isCurrentLocation(selectedPlace) && (
                    <PlaceMarker latitude={selectedPlace.latitude} longitude={selectedPlace.longitude} color={DESTINATION_PIN_COLOR} title={selectedPlace.name} />
                )}

                <UserLocationMarker position={position} heading={compass} poseFeed={follow.poseFeed} tilted={follow.mode === 'heading'}/>
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
                        <ActivityIndicator size="small" color={ACCENT} />
                        <Text style={{ color: theme.color, fontSize: 13, fontWeight: '600' }}>
                            Finding your route…
                        </Text>
                    </View>
                </View>
            )}

            <MapPickOverlay mapRef={mapRef} />
            <Speedometer animatedPosition={bottomSheetPosition} />
            <LocationButton mode={follow.mode} onPress={follow.press} animatedPosition={bottomSheetPosition} />
            {/*<DebugControls />*/}
            {__DEV__ && <DebugMovementControls mapRef={mapRef} animatedPosition={bottomSheetPosition} followsUser={follow.mode !== 'free'}/>}
            <RouteBottomSheetModal ref={modalRef} animatedPosition={bottomSheetPosition} />
            <StopDeparturesSheet
                ref={departuresRef}
                stop={departureStop}
                animatedPosition={bottomSheetPosition}
                onClose={() => {
                    setDepartureStop(null);
                    setTripFocus(null);
                }}
                onRoutes={setStopRouteKeys}
                onTripFocus={setTripFocus}
                onSnap={index => setDeparturesLowered(index === 0)}
                vehicles={vehicles}
            />
        </View>
    );
}