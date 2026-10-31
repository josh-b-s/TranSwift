import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { ACCENT, SHADOW, TOP_SAFE, useThemeStyle } from '@/constants/themes';
import RouteSheetHeader from '@/components/sheets/RouteSheetHeader';
import DepartureFilterChips from '@/components/sheets/DepartureFilterChips';
import DepartureTripStops from '@/components/sheets/DepartureTripStops';
import DepartureDelay from '@/components/sheets/DepartureDelay';
import StationDetailSection from '@/components/sheets/StationDetailSection';
import ServiceAlertList from '@/components/sheets/ServiceAlertList';
import { useStopDepartures } from '@/hooks/stopDepartures';
import { useServiceAlerts } from '@/hooks/serviceAlerts';
import { useStopsAway } from '@/hooks/stopsAway';
import { alertsForStop } from '@/services/gtfs/alerts/serviceAlert';
import type { VehicleFix } from '@/services/gtfs/vehicles/vehicleFix';
import type { TripFocus } from '@/hooks/tripPath';
import { useSavedPlace } from '@/hooks/savedPlace';
import { stopToPlace } from '@/services/places/endpoints';
import type { RepoStop } from '@/services/gtfs/core/stopRepo';
import { routeKey } from '@/services/gtfs/vehicles/vehicleRoutes';
import { formatClock, formatDepartureIn, formatStopsAway } from '@/services/gtfs/departures/departureFormat';
import type { Departure } from '@/services/gtfs/departures/stopDepartures';
import {
    applyDepartureFilter,
    filterLines,
    filterTermini,
    NO_FILTER,
    pickLine,
    type DepartureFilter,
} from '@/services/gtfs/departures/departureFilter';

const departureKey = (d: Departure) => `${d.dayStartMs}:${d.tripPk}`;

type Props = {
    stop: RepoStop | null;
    animatedPosition: SharedValue<number>;
    onClose: () => void;
    /** Told which routes serve the stop (see `routeKey`), so the map can show their vehicles. */
    onRoutes?: (keys: string[]) => void;
    /** Told which trip's whole line to show on the map: the departure that is expanded, or null when none is. */
    onTripFocus?: (focus: TripFocus | null) => void;
    /** The vehicles the map is tracking, used for how many stops away each departure is. */
    vehicles: VehicleFix[];
};

const StopDeparturesSheet = forwardRef<BottomSheetModal, Props>(({ stop, animatedPosition, onClose, onRoutes, onTripFocus, vehicles }, ref) => {
    const theme = useThemeStyle();
    const tabBarHeight = useBottomTabBarHeight();
    const { departures, loading, error, live } = useStopDepartures(stop);
    const serviceAlerts = useServiceAlerts(stop !== null);
    const stopsAway = useStopsAway(departures, vehicles);
    const savedStop = useSavedPlace(useMemo(() => (stop ? stopToPlace(stop) : null), [stop]));

    const [filter, setFilter] = useState<DepartureFilter>(NO_FILTER);
    const [openKey, setOpenKey] = useState<string | null>(null);
    useEffect(() => {
        setFilter(NO_FILTER);
        setOpenKey(null);
    }, [stop]);

    const routeIds = [...new Set(departures.map(d => routeKey(d.routeName, d.routeType)))].sort().join('\n');
    useEffect(() => {
        onRoutes?.(routeIds === '' ? [] : routeIds.split('\n'));
        return () => onRoutes?.([]);
    }, [routeIds]);

    const stopAlerts = useMemo(
        () => (stop ? alertsForStop(serviceAlerts, stop.stop_id, routeIds === '' ? [] : routeIds.split('\n')) : []),
        [serviceAlerts, stop, routeIds],
    );

    const lines = filterLines(departures);
    const termini = filterTermini(departures, filter.line);
    const shown = applyDepartureFilter(departures, filter);
    const openDeparture = shown.find(d => departureKey(d) === openKey);
    const openTripPk = openDeparture?.tripPk ?? null;
    useEffect(() => {
        onTripFocus?.(openDeparture ? { trip: { tripPk: openDeparture.tripPk }, color: openDeparture.routeColor } : null);
    }, [openTripPk]);
    const now = Date.now();
    const noteStyle = { color: theme.color, opacity: 0.6, fontSize: 14, textAlign: 'center' as const, padding: 24 };

    return (
        <BottomSheetModal
            ref={ref}
            animatedPosition={animatedPosition}
            backgroundStyle={{
                backgroundColor: theme.surfaceColor,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
            }}
            handleIndicatorStyle={{ backgroundColor: theme.color + '55', width: 40 }}
            style={[SHADOW, { borderTopLeftRadius: 28, borderTopRightRadius: 28 }]}
            topInset={TOP_SAFE(useSafeAreaInsets())}
            bottomInset={tabBarHeight}
            index={1}
            snapPoints={['16%', '45%', '100%']}
            enableDynamicSizing={false}
            onDismiss={onClose}
        >
            <BottomSheetScrollView stickyHeaderIndices={[0]} contentContainerStyle={{ paddingBottom: 24 }}>
                <View style={{ backgroundColor: theme.surfaceColor, paddingTop: 8 }}>
                    {stop && (
                        <RouteSheetHeader
                            name={stop.stop_name}
                            address={lines.length > 0 ? lines.join(' · ') : undefined}
                            closeLabel="Close departures"
                            saved={savedStop}
                            onClose={onClose}
                        />
                    )}
                </View>

                <StationDetailSection stop={stop} />

                <ServiceAlertList alerts={stopAlerts} style={{ paddingHorizontal: 24, paddingBottom: 12 }} />

                {lines.length > 1 && (
                    <DepartureFilterChips
                        label="Filter by line"
                        options={lines}
                        selected={filter.line}
                        onSelect={line => setFilter(current => pickLine(current, departures, line))}
                    />
                )}
                {termini.length > 1 && (
                    <DepartureFilterChips
                        label="Filter by direction"
                        options={termini}
                        selected={filter.terminus}
                        prefix="to "
                        onSelect={terminus => setFilter(current => ({ ...current, terminus }))}
                    />
                )}

                {loading && <ActivityIndicator style={{ padding: 24 }} color={ACCENT} />}
                {error && <Text style={noteStyle}>{error}</Text>}
                {!loading && !error && shown.length === 0 && (
                    <Text style={noteStyle}>
                        {departures.length === 0 ? 'No departures in the next 3 hours.' : 'No departures match this filter.'}
                    </Text>
                )}

                <View style={{ gap: 8, paddingHorizontal: 24 }}>
                    {shown.map(d => {
                        const relative = formatDepartureIn(d.liveTimeMs, now);
                        const clock = formatClock(d.liveTimeMs);
                        const key = departureKey(d);
                        const away = stopsAway.get(d.tripPk);
                        const open = key === openKey;
                        return (
                            <Pressable
                                key={key}
                                accessibilityRole={d.added ? 'text' : 'button'}
                                accessibilityLabel={d.added ? `${d.routeName} to ${d.terminus}, extra service` : `${d.routeName} to ${d.terminus}, ${open ? 'hide' : 'show'} stops`}
                                accessibilityState={d.added ? undefined : { expanded: open }}
                                onPress={d.added ? undefined : () => setOpenKey(open ? null : key)}
                                style={{ borderRadius: 16, padding: 14, backgroundColor: theme.backgroundColor }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: d.routeColor }}>
                                        <Text style={{ color: d.routeTextColor, fontSize: 13, fontWeight: '700' }}>{d.routeName}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text
                                            numberOfLines={1}
                                            style={{ color: theme.color, fontSize: 14, textDecorationLine: d.cancelled ? 'line-through' : 'none' }}
                                        >
                                            {d.terminus ? `to ${d.terminus}` : ''}
                                        </Text>
                                        {d.added && (
                                            <Text style={{ color: theme.color, opacity: 0.6, fontSize: 12 }}>Extra service</Text>
                                        )}
                                        {d.skipped && !d.cancelled && (
                                            <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Not stopping here</Text>
                                        )}
                                        {away !== undefined && !d.cancelled && !d.skipped && (
                                            <Text style={{ color: theme.color, opacity: 0.6, fontSize: 12 }}>{formatStopsAway(away)}</Text>
                                        )}
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        {d.cancelled ? (
                                            <Text style={{ color: '#ef4444', fontSize: 15, fontWeight: '700' }}>Cancelled</Text>
                                        ) : (
                                            <>
                                                <Text style={{ color: theme.color, fontSize: 15, fontWeight: '700' }}>{relative}</Text>
                                                {relative !== clock && (
                                                    <Text style={{ color: theme.color, opacity: 0.55, fontSize: 12 }}>{clock}</Text>
                                                )}
                                                {d.delaySec !== null && <DepartureDelay delaySec={d.delaySec} />}
                                            </>
                                        )}
                                    </View>
                                </View>
                                {open && !d.added && <DepartureTripStops departure={d} />}
                            </Pressable>
                        );
                    })}
                </View>

                {departures.length > 0 && (
                    <Text style={{ ...noteStyle, fontSize: 12 }}>
                        {live ? 'Live where the operator reports delays, otherwise scheduled.' : 'Scheduled times, not live.'}
                    </Text>
                )}
            </BottomSheetScrollView>
        </BottomSheetModal>
    );
});

StopDeparturesSheet.displayName = 'StopDeparturesSheet';

export default StopDeparturesSheet;
