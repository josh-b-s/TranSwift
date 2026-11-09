import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useBackHandler } from '@/hooks/backHandler';
import { ChevronDown } from 'lucide-react-native';
import { ACCENT, RADIUS, SHADOW, TOP_SAFE, useThemeStyle } from '@/constants/themes';
import RouteSheetHeader from '@/components/sheets/RouteSheetHeader';
import DepartureFilterChips from '@/components/sheets/DepartureFilterChips';
import DepartureRow from '@/components/sheets/DepartureRow';
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
import type { Departure } from '@/services/gtfs/departures/stopDepartures';
import { groupDepartures } from '@/services/gtfs/departures/departureGroups';
import { formatDepartureIn } from '@/services/gtfs/departures/departureFormat';
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
    /** Told the snap point the sheet settles on, 0 being the lowest. */
    onSnap?: (index: number) => void;
    /** The vehicles the map is tracking, used for how many stops away each departure is. */
    vehicles: VehicleFix[];
};

const StopDeparturesSheet = forwardRef<BottomSheetModal, Props>(({ stop, animatedPosition, onClose, onRoutes, onTripFocus, onSnap, vehicles }, ref) => {
    const theme = useThemeStyle();
    const tabBarHeight = useBottomTabBarHeight();
    const { departures, loading, error, live } = useStopDepartures(stop);
    const serviceAlerts = useServiceAlerts(stop !== null);
    const stopsAway = useStopsAway(departures, vehicles);
    const savedStop = useSavedPlace(useMemo(() => (stop ? stopToPlace(stop) : null), [stop]));

    const [filter, setFilter] = useState<DepartureFilter>(NO_FILTER);
    const [openKey, setOpenKey] = useState<string | null>(null);
    const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
    useEffect(() => {
        setFilter(NO_FILTER);
        setOpenKey(null);
        setOpenGroupKey(null);
    }, [stop]);

    // Back puts an opened departure away, then an opened group, before it closes the sheet.
    const focused = useIsFocused();
    useBackHandler(focused && stop !== null && (openKey !== null || openGroupKey !== null), () => {
        if (openKey !== null) setOpenKey(null);
        else setOpenGroupKey(null);
        return true;
    });

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
    const groups = groupDepartures(shown);
    const openGroup = groups.find(g => g.key === openGroupKey);
    const openDeparture = shown.find(d => departureKey(d) === openKey);
    // An open departure shows its own trip. Otherwise an open group shows its line, through its first trip the timetable knows.
    const focusDeparture = openDeparture ?? openGroup?.departures.find(d => !d.added && !d.cancelled);
    const focusTripPk = focusDeparture?.tripPk ?? null;
    useEffect(() => {
        onTripFocus?.(focusDeparture ? { trip: { tripPk: focusDeparture.tripPk }, color: focusDeparture.routeColor, routeKey: routeKey(focusDeparture.routeName, focusDeparture.routeType) } : null);
    }, [focusTripPk]);
    const now = Date.now();
    const noteStyle = { color: theme.muted, fontSize: 14, textAlign: 'center' as const, padding: 24 };

    return (
        <BottomSheetModal
            ref={ref}
            animatedPosition={animatedPosition}
            backgroundStyle={{
                backgroundColor: theme.surfaceColor,
                borderTopLeftRadius: RADIUS.sheet,
                borderTopRightRadius: RADIUS.sheet,
            }}
            handleIndicatorStyle={{ backgroundColor: theme.color + '55', width: 40 }}
            style={[SHADOW, { borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }]}
            topInset={TOP_SAFE(useSafeAreaInsets())}
            bottomInset={tabBarHeight}
            index={1}
            snapPoints={['16%', '45%', '100%']}
            enableDynamicSizing={false}
            onChange={index => onSnap?.(index)}
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
                    {groups.map(group => {
                        const open = group.key === openGroupKey;
                        const upcoming = group.departures.filter(d => !d.cancelled);
                        const later = upcoming.slice(1, 3).map(d => formatDepartureIn(d.liveTimeMs, now)).join(', ');
                        return (
                            <View key={group.key} style={{ gap: 8 }}>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`${group.routeName} to ${group.terminus}, ${open ? 'hide' : 'show'} departures`}
                                    accessibilityState={{ expanded: open }}
                                    onPress={() => {
                                        setOpenKey(null);
                                        setOpenGroupKey(open ? null : group.key);
                                    }}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: RADIUS.tile, padding: 14, backgroundColor: theme.backgroundColor }}
                                >
                                    <View style={{ minWidth: 52, height: 36, paddingHorizontal: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: group.routeColor }}>
                                        <Text numberOfLines={1} style={{ color: group.routeTextColor, fontSize: 15, fontWeight: '800' }}>{group.routeName}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text numberOfLines={1} style={{ color: theme.color, fontSize: 15, fontWeight: '600' }}>
                                            {group.terminus ? `to ${group.terminus}` : ''}
                                        </Text>
                                        {later !== '' && (
                                            <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 12, marginTop: 1 }}>then {later}</Text>
                                        )}
                                    </View>
                                    <Text style={{ color: theme.color, fontSize: 17, fontWeight: '800' }}>
                                        {upcoming[0] ? formatDepartureIn(upcoming[0].liveTimeMs, now) : 'Cancelled'}
                                    </Text>
                                    <ChevronDown size={18} color={theme.muted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
                                </Pressable>

                                {open && group.departures.map(d => {
                                    const key = departureKey(d);
                                    return (
                                        <DepartureRow
                                            key={key}
                                            departure={d}
                                            open={key === openKey}
                                            stopsAway={stopsAway.get(d.tripPk)}
                                            nowMs={now}
                                            onToggle={() => setOpenKey(key === openKey ? null : key)}
                                        />
                                    );
                                })}
                            </View>
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
