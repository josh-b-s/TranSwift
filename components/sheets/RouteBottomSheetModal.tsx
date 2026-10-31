import React, { forwardRef, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SharedValue } from 'react-native-reanimated';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '@/store/store';
import { ACCENT, DANGER, RADIUS, SHADOW, TOP_SAFE, useThemeStyle } from '@/constants/themes';
import RouteSheetHeader from '@/components/sheets/RouteSheetHeader';
import JourneyCard from '@/components/sheets/JourneyCard';
import JourneySortChips, { type SortKey } from '@/components/sheets/JourneySortChips';
import { useServiceAlerts } from '@/hooks/serviceAlerts';
import { alertsForRoutes } from '@/services/gtfs/alerts/serviceAlert';
import { routeKey } from '@/services/gtfs/vehicles/vehicleRoutes';
import { useSavedPlace } from '@/hooks/savedPlace';
import { isCurrentLocation } from '@/services/places/endpoints';
import RouteOptionPills from '@/components/search/RouteOptionPills';
import TripButton from '@/components/trip/TripButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Bus, CircleAlert } from 'lucide-react-native';
import { clearRoute, selectJourney } from '@/store/route.slice';
import { endTrip } from '@/store/trip.slice';
import { selectPlace, setQuery } from '@/store/search.slice';
import { routeErrorMessage } from '@/services/gtfs/router/routeErrorMessage';

type Props = {
    animatedPosition: SharedValue<number>;
};

const RouteBottomSheetModal = forwardRef<BottomSheetModal, Props>(
    ({ animatedPosition }, ref) => {
        const theme = useThemeStyle();
        const dispatch = useDispatch<AppDispatch>();
        const { journeys = [], selectedJourneyIndex, error, loading } = useSelector((s: RootState) => s.route);
        const serviceAlerts = useServiceAlerts(journeys.length > 0);
        const selectedPlace = useSelector((s: RootState) => s.search.selected);
        const walkingSpeedMps = useSelector((s: RootState) => s.search.walkingSpeedMps);
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
                    borderTopLeftRadius: RADIUS.sheet,
                    borderTopRightRadius: RADIUS.sheet,
                }}
                handleIndicatorStyle={{ backgroundColor: theme.color + '55', width: 40 }}
                style={[SHADOW, { borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }]}
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
                        {/* Only worth showing when there's more than one option */}
                        {!error && journeys.length > 1 && <JourneySortChips value={sortKey} onChange={setSortKey} />}
                    </View>

                    {error ? (
                        <Note icon={<CircleAlert size={26} color={DANGER} />} tint={DANGER + '1f'}>
                            <Text style={{ color: DANGER, fontSize: 15, textAlign: 'center' }}>{routeErrorMessage(error)}</Text>
                        </Note>
                    ) : journeys.length === 0 ? (
                        loading ? (
                            <Note icon={<ActivityIndicator color={ACCENT} />} tint={theme.accentSoft}>
                                <Text style={{ color: theme.muted, fontSize: 14 }}>Calculating route…</Text>
                            </Note>
                        ) : (
                            <Note icon={<Bus size={26} color={theme.muted} />} tint={theme.hairline}>
                                <Text style={{ color: theme.color, fontSize: 16, fontWeight: '700' }}>No transit route found</Text>
                                <Text style={{ color: theme.muted, fontSize: 13, textAlign: 'center' }}>
                                    Try a different departure time or a faster walking speed.
                                </Text>
                            </Note>
                        )
                    ) : (
                        <View style={{ paddingHorizontal: 24, gap: 12 }}>
                            {sorted.map(({ journey, originalIndex }) => (
                                <JourneyCard
                                    key={originalIndex}
                                    journey={journey}
                                    selected={originalIndex === selectedJourneyIndex}
                                    walkingSpeedMps={walkingSpeedMps}
                                    onSelect={() => dispatch(selectJourney(originalIndex))}
                                    alerts={alertsForRoutes(serviceAlerts, journey.legs.map(leg => routeKey(leg.routeName, leg.routeType)))}
                                />
                            ))}
                        </View>
                    )}
                </BottomSheetScrollView>
            </BottomSheetModal>
        );
    }
);

export default RouteBottomSheetModal;

/** A centred message in the results area: an icon on a soft disc, then the text. */
function Note({ icon, tint, children }: { icon: React.ReactNode; tint: string; children: React.ReactNode }) {
    return (
        <View style={{ padding: 32, alignItems: 'center', gap: 8 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: tint, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                {icon}
            </View>
            {children}
        </View>
    );
}
