import React, { forwardRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SharedValue } from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Trophy } from 'lucide-react-native';
import { RootState } from '@/store/store';
import { ACCENT, DANGER, RADIUS, SHADOW, SUCCESS, TOP_SAFE, useThemeStyle } from '@/constants/themes';
import { MAP_TOP_BAR_HEIGHT } from '@/components/map/MapTopBar';
import TripStats from '@/components/trip/TripStats';
import TripLegList from '@/components/trip/TripLegList';
import SpeedScrubber from '@/components/trip/SpeedScrubber';
import TripSplits from '@/components/trip/TripSplits';
import MatchedTrips from '@/components/trip/MatchedTrips';
import TripShare from '@/components/trip/TripShare';
import type { ViewedTrip } from '@/hooks/viewedTrip';

type Props = {
    animatedPosition: SharedValue<number>;
    viewed: ViewedTrip | null;
    error: string | null;
    scrubFraction: number | null;
    onScrub: (fraction: number) => void;
};

/** What a saved trip came to, over the map that shows its route. */
const TripSummarySheet = forwardRef<BottomSheetModal, Props>(({ animatedPosition, viewed, error, scrubFraction, onScrub }, ref) => {
    const theme = useThemeStyle();
    const insets = useSafeAreaInsets();
    const tabBarHeight = useBottomTabBarHeight();
    const unit = useSelector((s: RootState) => s.preferences.speedUnit);

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
            // Stops below the top bar, which floats over the map.
            topInset={TOP_SAFE(insets) + MAP_TOP_BAR_HEIGHT}
            bottomInset={tabBarHeight}
            index={1}
            snapPoints={['16%', '45%', '100%']}
            enableOverDrag={false}
            enablePanDownToClose={false}
            enableDynamicSizing={false}
        >
            <BottomSheetScrollView contentContainerStyle={{ padding: 24, paddingTop: 8, paddingBottom: 24, gap: 16 }}>
                {error ? (
                    <Text style={{ color: DANGER, textAlign: 'center' }}>Could not open this trip. {error}</Text>
                ) : !viewed ? (
                    <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} />
                ) : (
                    <>
                        {viewed.speedTrack.length > 0 && (
                            <SpeedScrubber track={viewed.speedTrack} unit={unit} fraction={scrubFraction} onChange={onScrub} />
                        )}
                        <TripStats summary={viewed.summary} unit={unit} />
                        {viewed.records.length > 0 && (
                            <View style={{ borderRadius: RADIUS.tile, padding: 14, backgroundColor: theme.backgroundColor, gap: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Trophy size={18} color={SUCCESS} />
                                    <Text style={{ color: theme.color, fontSize: 15, fontWeight: '700' }}>New records</Text>
                                </View>
                                {viewed.records.map(line => (
                                    <Text key={line} style={{ color: theme.color, fontSize: 14 }}>{line}</Text>
                                ))}
                            </View>
                        )}
                        {viewed.splits.length > 0 && <TripSplits splits={viewed.splits} unit={unit} />}
                        {viewed.matches && <MatchedTrips matches={viewed.matches} currentStartedAt={viewed.trip.startedAt} unit={unit} />}
                        <TripLegList legs={viewed.summary.legs} newBestKeys={viewed.newBestKeys} unit={unit} />
                        <TripShare trip={viewed.trip} summary={viewed.summary} unit={unit} />
                    </>
                )}
            </BottomSheetScrollView>
        </BottomSheetModal>
    );
});

export default TripSummarySheet;
