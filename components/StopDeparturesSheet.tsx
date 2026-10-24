import React, { forwardRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { ACCENT, SHADOW, TOP_SAFE, useThemeStyle } from '@/constants/themes';
import RouteSheetHeader from '@/components/RouteSheetHeader';
import { useStopDepartures } from '@/hooks/stopDepartures';
import type { RepoStop } from '@/services/gtfs/core/gtfsRepo';
import { formatClock, formatDepartureIn } from '@/services/gtfs/departures/departureFormat';

type Props = {
    stop: RepoStop | null;
    animatedPosition: SharedValue<number>;
    onClose: () => void;
};

const StopDeparturesSheet = forwardRef<BottomSheetModal, Props>(({ stop, animatedPosition, onClose }, ref) => {
    const theme = useThemeStyle();
    const tabBarHeight = useBottomTabBarHeight();
    const { departures, loading, error } = useStopDepartures(stop);

    const lines = [...new Set(departures.map(d => d.routeName))];
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
                            onClose={onClose}
                        />
                    )}
                </View>

                {loading && <ActivityIndicator style={{ padding: 24 }} color={ACCENT} />}
                {error && <Text style={noteStyle}>{error}</Text>}
                {!loading && !error && departures.length === 0 && (
                    <Text style={noteStyle}>No departures in the next 3 hours.</Text>
                )}

                <View style={{ gap: 8, paddingHorizontal: 24 }}>
                    {departures.map((d, i) => {
                        const relative = formatDepartureIn(d.timeMs, now);
                        const clock = formatClock(d.timeMs);
                        return (
                            <View
                                key={i}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 10,
                                    borderRadius: 16,
                                    padding: 14,
                                    backgroundColor: theme.backgroundColor,
                                }}
                            >
                                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: d.routeColor }}>
                                    <Text style={{ color: d.routeTextColor, fontSize: 13, fontWeight: '700' }}>{d.routeName}</Text>
                                </View>
                                <Text numberOfLines={1} style={{ flex: 1, color: theme.color, fontSize: 14 }}>
                                    {d.terminus ? `to ${d.terminus}` : ''}
                                </Text>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ color: theme.color, fontSize: 15, fontWeight: '700' }}>{relative}</Text>
                                    {relative !== clock && (
                                        <Text style={{ color: theme.color, opacity: 0.55, fontSize: 12 }}>{clock}</Text>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </View>

                {departures.length > 0 && (
                    <Text style={{ ...noteStyle, fontSize: 12 }}>Scheduled times, not live.</Text>
                )}
            </BottomSheetScrollView>
        </BottomSheetModal>
    );
});

StopDeparturesSheet.displayName = 'StopDeparturesSheet';

export default StopDeparturesSheet;
