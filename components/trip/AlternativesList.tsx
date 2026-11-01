import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ban, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { closeAlternatives, setAvoiding } from '@/store/alternatives.slice';
import { requestSwitch } from '@/store/trip.slice';
import { ACCENT, RADIUS, useThemeStyle } from '@/constants/themes';
import JourneyCard from '@/components/sheets/JourneyCard';
import type { ResolvedAlert } from '@/services/gtfs/alerts/serviceAlert';
import { alertsForRoutes } from '@/services/gtfs/alerts/serviceAlert';
import { routeErrorMessage } from '@/services/gtfs/router/routeErrorMessage';
import { routeKey } from '@/services/gtfs/vehicles/vehicleRoutes';
import { usesRoute } from '@/services/trips/alternativeSearch';
import { stepsFromJourney } from '@/services/trips/tripSteps';

type Props = { serviceAlerts: ResolvedAlert[]; walkingSpeedMps: number };

/** Other ways to the destination, found mid-trip. Choosing one carries the trip on along it. */
export default function AlternativesList({ serviceAlerts, walkingSpeedMps }: Props) {
    const theme = useThemeStyle();
    const dispatch = useDispatch<AppDispatch>();
    const { loading, error, journeys, label, via, avoid, avoiding } = useSelector((s: RootState) => s.alternatives);
    const [selected, setSelected] = useState(0);

    const visible = avoiding && avoid ? journeys.filter(j => !usesRoute(j, avoid)) : journeys;
    const hidden = journeys.length - visible.length;
    const chosen = visible[Math.min(selected, visible.length - 1)];

    const switchToChosen = () => {
        if (!chosen) return;
        Haptics.selectionAsync();
        dispatch(requestSwitch({ steps: stepsFromJourney(chosen), via }));
        dispatch(closeAlternatives());
    };

    return (
        <View style={{ paddingHorizontal: 24, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text numberOfLines={1} style={{ flex: 1, color: theme.color, fontSize: 16, fontWeight: '700' }}>
                    Alternatives from {label}
                </Text>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close alternatives"
                    hitSlop={8}
                    onPress={() => dispatch(closeAlternatives())}
                    style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.hairline }}
                >
                    <X size={16} color={theme.color} />
                </Pressable>
            </View>

            {avoid && (
                <Pressable
                    accessibilityRole="switch"
                    accessibilityState={{ checked: avoiding }}
                    onPress={() => {
                        Haptics.selectionAsync();
                        dispatch(setAvoiding(!avoiding));
                    }}
                    style={{
                        alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
                        paddingVertical: 8, paddingHorizontal: 14, borderRadius: RADIUS.chip,
                        backgroundColor: avoiding ? ACCENT : theme.hairline,
                    }}
                >
                    <Ban size={14} color={avoiding ? '#fff' : theme.color} />
                    <Text style={{ color: avoiding ? '#fff' : theme.color, fontSize: 13, fontWeight: '600' }}>
                        {avoiding ? `Avoiding ${avoid.name}` : `Avoid ${avoid.name}`}
                    </Text>
                </Pressable>
            )}

            {loading && <ActivityIndicator color={ACCENT} style={{ padding: 24 }} />}
            {!loading && error && (
                <Text style={{ color: theme.muted, fontSize: 14, textAlign: 'center', padding: 16 }}>{routeErrorMessage(error)}</Text>
            )}
            {!loading && !error && visible.length === 0 && (
                <Text style={{ color: theme.muted, fontSize: 14, textAlign: 'center', padding: 16 }}>
                    {hidden > 0
                        ? `${hidden} ${hidden === 1 ? 'option uses' : 'options use'} ${avoid?.name}. Turn off the filter to see ${hidden === 1 ? 'it' : 'them'}.`
                        : 'No other options found.'}
                </Text>
            )}

            {chosen && (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Switch to this route"
                    onPress={switchToChosen}
                    style={{ alignItems: 'center', paddingVertical: 12, borderRadius: 24, backgroundColor: ACCENT }}
                >
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Switch to this route</Text>
                </Pressable>
            )}

            {visible.map((journey, i) => (
                <JourneyCard
                    key={`${journey.departureTime}-${journey.arrivalTime}-${i}`}
                    journey={journey}
                    selected={journey === chosen}
                    walkingSpeedMps={walkingSpeedMps}
                    onSelect={() => setSelected(i)}
                    alerts={alertsForRoutes(serviceAlerts, journey.legs.map(leg => routeKey(leg.routeName, leg.routeType)))}
                />
            ))}
        </View>
    );
}
