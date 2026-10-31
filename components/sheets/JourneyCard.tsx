import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowLeftRight, Footprints } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { ACCENT, RADIUS, useThemeStyle } from '@/constants/themes';
import JourneyBar from '@/components/sheets/JourneyBar';
import JourneyTimeline from '@/components/sheets/JourneyTimeline';
import ServiceAlertList from '@/components/sheets/ServiceAlertList';
import { formatJourneyClock, formatJourneyDuration, formatWalkDistance } from '@/services/gtfs/router/journeyFormat';
import type { GtfsJourney } from '@/services/gtfs/router/routeTypes';
import type { ResolvedAlert } from '@/services/gtfs/alerts/serviceAlert';

type Props = {
    journey: GtfsJourney;
    selected: boolean;
    onSelect: () => void;
    /** Alerts for the routes on this journey, shown when it is selected. */
    alerts: ResolvedAlert[];
    /** The rider's pace, for timing the walks. */
    walkingSpeedMps: number;
};

/** One journey option: how long it takes, a bar of its rides, and what it costs in walking and transfers. Opens to a timeline when selected. */
export default function JourneyCard({ journey, selected, onSelect, alerts, walkingSpeedMps }: Props) {
    const theme = useThemeStyle();
    const depart = formatJourneyClock(journey.departureTime);
    const arrive = formatJourneyClock(journey.arrivalTime);
    const duration = formatJourneyDuration(journey.totalDurationMin);
    const transfers = journey.transferCount === 0 ? 'Direct' : `${journey.transferCount} transfer${journey.transferCount === 1 ? '' : 's'}`;
    const meta = { color: theme.muted, fontSize: 13, fontWeight: '500' as const };

    return (
        // Layout animation lets the cards below slide when this one opens, and when the sort order changes.
        <Animated.View layout={LinearTransition.duration(220)}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Journey departing ${depart}, arriving ${arrive}, ${duration}`}
                accessibilityState={{ selected }}
                onPress={() => {
                    Haptics.selectionAsync();
                    onSelect();
                }}
                style={{
                    borderRadius: RADIUS.card,
                    borderWidth: 2,
                    borderColor: selected ? ACCENT : 'transparent',
                    backgroundColor: theme.backgroundColor,
                    padding: 16,
                    gap: 14,
                }}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Text style={{ color: theme.color, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>{duration}</Text>
                    <Text style={{ color: theme.muted, fontSize: 14, fontWeight: '500' }}>{depart} – {arrive}</Text>
                </View>

                <JourneyBar journey={journey} walkingSpeedMps={walkingSpeedMps} />

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Footprints size={14} color={theme.muted} />
                        <Text style={meta}>{formatWalkDistance(journey.totalWalkingMeters)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <ArrowLeftRight size={14} color={theme.muted} />
                        <Text style={meta}>{transfers}</Text>
                    </View>
                </View>

                {selected && (
                    <Animated.View entering={FadeIn.duration(220)} style={{ paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.hairline, gap: 12 }}>
                        <ServiceAlertList alerts={alerts} />
                        <JourneyTimeline legs={journey.legs} />
                    </Animated.View>
                )}
            </Pressable>
        </Animated.View>
    );
}
