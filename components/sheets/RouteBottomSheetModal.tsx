import React, { forwardRef, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SharedValue } from 'react-native-reanimated';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '@/store/store';
import { ACCENT, SHADOW, TOP_SAFE, useThemeStyle } from '@/constants/themes';
import { modeIcon } from '@/constants/modeIcons';
import RouteSheetHeader from '@/components/sheets/RouteSheetHeader';
import ServiceAlertList from '@/components/sheets/ServiceAlertList';
import { useServiceAlerts } from '@/hooks/serviceAlerts';
import { alertsForRoutes } from '@/services/gtfs/alerts/serviceAlert';
import { routeKey } from '@/services/gtfs/vehicles/vehicleRoutes';
import { useSavedPlace } from '@/hooks/savedPlace';
import { isCurrentLocation } from '@/services/places/endpoints';
import RouteOptionPills from '@/components/search/RouteOptionPills';
import TripButton from '@/components/trip/TripButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { ArrowLeftRight, Bus, ChevronRight, CircleAlert, Footprints, type LucideIcon, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { clearRoute, selectJourney } from '@/store/route.slice';
import { endTrip } from '@/store/trip.slice';
import { selectPlace, setQuery } from '@/store/search.slice';
import {classifyRouteType} from "@/services/gtfs/core/routeTypeUtil";
import { routeErrorMessage } from '@/services/gtfs/router/routeErrorMessage';

type Props = {
    animatedPosition: SharedValue<number>;
};

type SortKey = 'arrival' | 'walking' | 'transfers';

const SORT_OPTIONS: { key: SortKey; label: string; icon: LucideIcon }[] = [
    { key: 'arrival',   label: 'Fastest',          icon: Zap },
    { key: 'walking',   label: 'Least walking',    icon: Footprints },
    { key: 'transfers', label: 'Fewest transfers', icon: ArrowLeftRight },
];

// Journey times come out of the router as raw GTFS "HH:MM:SS" strings
// (sometimes with hours >= 24 for past-midnight trips, per spec) — that
// precision/format is right for internal sorting and computation, but
// showing seconds and 24h-past-midnight hours to a rider is just noise.
// This is display-only formatting; the underlying string is untouched.
function formatClock(hhmmss: string): string {
    const [hStr, mStr] = hhmmss.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return hhmmss;
    const dayOffset = Math.floor(h / 24);
    const d = new Date();
    d.setHours(h % 24, m, 0, 0);
    const label = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return dayOffset > 0 ? `${label} (+${dayOffset}d)` : label;
}

function formatDuration(mins: number): string {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatWalking(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)} m walk`;
    return `${(meters / 1000).toFixed(1)} km walk`;
}

const RouteBottomSheetModal = forwardRef<BottomSheetModal, Props>(
    ({ animatedPosition }, ref) => {
        const theme = useThemeStyle();
        const dispatch = useDispatch<AppDispatch>();
        const { journeys = [], selectedJourneyIndex, error, loading } = useSelector((s: RootState) => s.route);
        const serviceAlerts = useServiceAlerts(journeys.length > 0);
        const selectedPlace = useSelector((s: RootState) => s.search.selected);
        const savedPlace = useSavedPlace(selectedPlace && !isCurrentLocation(selectedPlace) ? selectedPlace : null);
        const [sortKey, setSortKey] = useState<SortKey>('arrival');
        const tabBarHeight = useBottomTabBarHeight();

        const closeRoute = () => {
            dispatch(selectPlace(null));
            dispatch(clearRoute());
            dispatch(endTrip());
            dispatch(setQuery(''));
        };

        // Sort for DISPLAY only — selection is always by original journeys[]
        // index so the map/state stays in sync regardless of sort order.
        const sorted = useMemo(
            () => journeys.map((j, i) => ({ journey: j, originalIndex: i }))
                .sort((a, b) => {
                    switch (sortKey) {
                        case 'walking':   return a.journey.totalWalkingMeters - b.journey.totalWalkingMeters;
                        case 'transfers': return a.journey.transferCount - b.journey.transferCount;
                        case 'arrival':
                        default:          return a.journey.arrivalTime.localeCompare(b.journey.arrivalTime);
                    }
                }),
            [journeys, sortKey],
        );

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
                // Reserves the navbar's height at the bottom of the sheet's
                // own container, so even at the 100% snap point the sheet
                // stops short of it and the navbar stays on top/visible
                // instead of getting covered.
                bottomInset={tabBarHeight}
                index={1}
                snapPoints={['16%', '45%', '100%']}
                enableOverDrag={false}
                enablePanDownToClose={false}
                // Fixed snap points only; the content height must not add its own.
                enableDynamicSizing={false}
            >
                {/* One scroll controller for the whole sheet: dragging up expands it before the list scrolls, and pulling down at the top lowers it. The header block is sticky so it stays visible. */}
                <BottomSheetScrollView stickyHeaderIndices={[0]} contentContainerStyle={{ paddingBottom: 24 }}>
                    <View style={{ backgroundColor: theme.surfaceColor, paddingTop: 8 }}>
                    {selectedPlace && (
                        <RouteSheetHeader
                            name={selectedPlace.name}
                            address={selectedPlace.address}
                            saved={savedPlace}
                            onClose={closeRoute}
                        />
                    )}
                    {selectedPlace && <RouteOptionPills />}
                    {selectedPlace && !error && <TripButton />}
                        {/* Sort control, only worth showing when there's more than one option */}
                        {!error && journeys.length > 1 && (
                                <View
                                    accessibilityRole="tablist"
                                    style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingBottom: 12 }}
                                >
                                    {SORT_OPTIONS.map(opt => {
                                        const active = sortKey === opt.key;
                                        return (
                                            <Pressable
                                                key={opt.key}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Sort by ${opt.label}`}
                                                accessibilityState={{ selected: active }}
                                                onPress={() => {
                                                    Haptics.selectionAsync();
                                                    setSortKey(opt.key);
                                                }}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 5,
                                                    paddingHorizontal: 12,
                                                    paddingVertical: 7,
                                                    borderRadius: 999,
                                                    backgroundColor: active ? ACCENT : theme.backgroundColor,
                                                }}
                                            >
                                                <opt.icon size={14} color={active ? '#fff' : theme.color} />
                                                <Text style={{ color: active ? '#fff' : theme.color, fontSize: 13, fontWeight: '600' }}>
                                                    {opt.label}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                        )}
                    </View>

                    {error ? (
                        <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>
                            <CircleAlert size={28} color="#ef4444" />
                            <Text style={{ color: '#ef4444', fontSize: 15, textAlign: 'center' }}>{routeErrorMessage(error)}</Text>
                        </View>
                    ) : journeys.length === 0 ? (
                        loading ? (
                            <View style={{ padding: 24, alignItems: 'center', gap: 10 }}>
                                <ActivityIndicator color={ACCENT} />
                                <Text style={{ color: theme.color, opacity: 0.5, fontSize: 14 }}>Calculating route…</Text>
                            </View>
                        ) : (
                            <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>
                                <Bus size={28} color={theme.color} style={{ opacity: 0.4 }} />
                                <Text style={{ color: theme.color, fontSize: 15, fontWeight: '600' }}>No transit route found</Text>
                                <Text style={{ color: theme.color, opacity: 0.5, fontSize: 13, textAlign: 'center' }}>
                                    Try a different departure time or a faster walking speed.
                                </Text>
                            </View>
                        )
                    ) : (
                        <View style={{ paddingHorizontal: 24, gap: 12 }}>
                                {sorted.map(({ journey, originalIndex }) => {
                                    const isSelected = originalIndex === selectedJourneyIndex;
                                    return (
                                        <Pressable
                                            key={originalIndex}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Journey departing ${formatClock(journey.departureTime)}, arriving ${formatClock(journey.arrivalTime)}, ${formatDuration(journey.totalDurationMin)}`}
                                            accessibilityState={{ selected: isSelected }}
                                            onPress={() => {
                                                Haptics.selectionAsync();
                                                dispatch(selectJourney(originalIndex));
                                            }}
                                            style={{
                                                borderRadius: 20,
                                                borderWidth: 2,
                                                borderColor: isSelected ? ACCENT : 'transparent',
                                                backgroundColor: theme.backgroundColor,
                                                padding: 16,
                                                gap: 10,
                                            }}
                                        >
                                            {/* Duration leads: it's what riders compare first */}
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                                <Text style={{ color: theme.color, fontSize: 24, fontWeight: '700' }}>
                                                    {formatDuration(journey.totalDurationMin)}
                                                </Text>
                                                <Text style={{ color: theme.color, opacity: 0.6, fontSize: 14 }}>
                                                    {formatClock(journey.departureTime)} → {formatClock(journey.arrivalTime)}
                                                </Text>
                                            </View>

                                            {/* Leg pills, chained with chevrons so they read as a sequence */}
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                                                {journey.legs.map((leg, i) => {
                                                    const { category, label } = classifyRouteType(leg.routeType);
                                                    const ModeIcon = modeIcon(category);
                                                    return (
                                                        <React.Fragment key={i}>
                                                            {i > 0 && (
                                                                <ChevronRight size={12} color={theme.color} style={{ opacity: 0.35 }} />
                                                            )}
                                                            <View
                                                                style={{
                                                                    flexDirection: 'row',
                                                                    alignItems: 'center',
                                                                    gap: 5,
                                                                    paddingHorizontal: 10,
                                                                    paddingVertical: 5,
                                                                    borderRadius: 999,
                                                                    backgroundColor: leg.routeColor ?? ACCENT,
                                                                }}
                                                            >
                                                                <ModeIcon size={14} color={leg.routeTextColor ?? '#fff'} />
                                                                <Text style={{ color: leg.routeTextColor ?? '#fff', fontSize: 13, fontWeight: '700' }}>
                                                                    {label} {leg.routeName}
                                                                </Text>
                                                            </View>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </View>

                                            <Text style={{ color: theme.color, opacity: 0.6, fontSize: 13 }}>
                                                {formatWalking(journey.totalWalkingMeters)} · {journey.transferCount === 0 ? 'Direct' : `${journey.transferCount} transfer${journey.transferCount === 1 ? '' : 's'}`}
                                            </Text>

                                            {isSelected && (
                                                <View style={{ marginTop: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.color + '14' }}>
                                                    <ServiceAlertList
                                                        alerts={alertsForRoutes(serviceAlerts, journey.legs.map(leg => routeKey(leg.routeName, leg.routeType)))}
                                                        style={{ marginBottom: 12 }}
                                                    />
                                                    {journey.legs.map((leg, i) => {
                                                        const isLastLeg = i === journey.legs.length - 1;
                                                        return (
                                                            <React.Fragment key={i}>
                                                                <TimelineRow
                                                                    color={leg.routeColor ?? ACCENT}
                                                                    textColor={theme.color}
                                                                    lineColor={theme.color + '22'}
                                                                    label={`Board at ${leg.originStopName}`}
                                                                    time={leg.departureTime ? formatClock(leg.departureTime) + formatDelay(leg.departureDelaySec) : undefined}
                                                                />
                                                                <TimelineRow
                                                                    color={leg.routeColor ?? ACCENT}
                                                                    textColor={theme.color}
                                                                    lineColor={theme.color + '22'}
                                                                    label={`Alight at ${leg.destStopName}`}
                                                                    time={leg.arrivalTime ? formatClock(leg.arrivalTime) : undefined}
                                                                    isLast={isLastLeg}
                                                                />
                                                                {!isLastLeg && (
                                                                    <TimelineRow
                                                                        color="#f59e0b"
                                                                        textColor="#f59e0b"
                                                                        lineColor={theme.color + '22'}
                                                                        label="Transfer"
                                                                        bold
                                                                    />
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </View>
                                            )}
                                        </Pressable>
                                    );
                                })}
                        </View>
                    )}
                </BottomSheetScrollView>
            </BottomSheetModal>
        );
    }
);

export default RouteBottomSheetModal;

// One stop/transfer on the expanded journey's board/alight timeline — a
// dot on a connecting vertical line down the left edge, so a multi-transfer
// route reads as a path instead of a wall of stacked text.
function formatDelay(delaySec?: number): string {
    const min = Math.round((delaySec ?? 0) / 60);
    return min === 0 ? '' : ` (${min > 0 ? '+' : ''}${min} min)`;
}

function TimelineRow({ color, textColor, lineColor, label, time, isLast, bold }: {
    color: string;
    textColor: string;
    lineColor: string;
    label: string;
    time?: string;
    isLast?: boolean;
    bold?: boolean;
}) {
    return (
        <View style={{ flexDirection: 'row' }}>
            <View style={{ width: 14, alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginTop: 4 }} />
                {!isLast && <View style={{ width: 2, flex: 1, backgroundColor: lineColor, marginTop: 2 }} />}
            </View>
            <View style={{ flex: 1, paddingLeft: 8, paddingBottom: isLast ? 0 : 10 }}>
                <Text style={{ color: textColor, opacity: bold ? 1 : 0.75, fontSize: 13, fontWeight: bold ? '700' : '400' }}>
                    {label}{time ? `  ·  ${time}` : ''}
                </Text>
            </View>
        </View>
    );
}