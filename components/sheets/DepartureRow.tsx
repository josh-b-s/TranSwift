import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { DANGER, RADIUS, useThemeStyle } from '@/constants/themes';
import DepartureDelay from '@/components/sheets/DepartureDelay';
import DepartureTripStops from '@/components/sheets/DepartureTripStops';
import { formatClock, formatDepartureIn, formatStopsAway } from '@/services/gtfs/departures/departureFormat';
import type { LiveDeparture } from '@/services/gtfs/departures/liveDepartures';

type Props = {
    departure: LiveDeparture;
    open: boolean;
    /** Stops until the vehicle reaches this one, when it is tracked. */
    stopsAway?: number;
    nowMs: number;
    onToggle: () => void;
};

/** One departure: line badge, where it goes, and a large countdown. Tapping opens the stops it calls at. */
export default function DepartureRow({ departure: d, open, stopsAway, nowMs, onToggle }: Props) {
    const theme = useThemeStyle();
    const relative = formatDepartureIn(d.liveTimeMs, nowMs);
    const clock = formatClock(d.liveTimeMs);
    // "5 min" splits into a big number and a small unit; "Now" and clock times stand alone.
    const inMinutes = relative.endsWith(' min');
    const status = d.added ? 'Extra service'
        : d.skipped && !d.cancelled ? 'Not stopping here'
        : stopsAway !== undefined && !d.cancelled ? formatStopsAway(stopsAway)
        : null;

    return (
        <Pressable
            accessibilityRole={d.added ? 'text' : 'button'}
            accessibilityLabel={d.added ? `${d.routeName} to ${d.terminus}, extra service` : `${d.routeName} to ${d.terminus}, ${open ? 'hide' : 'show'} stops`}
            accessibilityState={d.added ? undefined : { expanded: open }}
            onPress={d.added ? undefined : onToggle}
            style={{ borderRadius: RADIUS.tile, padding: 14, backgroundColor: theme.backgroundColor }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                    style={{
                        minWidth: 52, height: 36, paddingHorizontal: 8, borderRadius: 10,
                        alignItems: 'center', justifyContent: 'center', backgroundColor: d.routeColor,
                    }}
                >
                    <Text numberOfLines={1} style={{ color: d.routeTextColor, fontSize: 15, fontWeight: '800' }}>{d.routeName}</Text>
                </View>

                <View style={{ flex: 1 }}>
                    <Text
                        numberOfLines={1}
                        style={{ color: theme.color, fontSize: 15, fontWeight: '600', textDecorationLine: d.cancelled ? 'line-through' : 'none' }}
                    >
                        {d.terminus ? `to ${d.terminus}` : ''}
                    </Text>
                    {status && (
                        <Text style={{ color: d.skipped && !d.cancelled ? DANGER : theme.muted, fontSize: 12, fontWeight: '600', marginTop: 1 }}>
                            {status}
                        </Text>
                    )}
                </View>

                <View style={{ alignItems: 'flex-end', minWidth: 56 }}>
                    {d.cancelled ? (
                        <Text style={{ color: DANGER, fontSize: 14, fontWeight: '700' }}>Cancelled</Text>
                    ) : (
                        <>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                                <Text style={{ color: theme.color, fontSize: inMinutes ? 24 : 17, fontWeight: '800', letterSpacing: -0.5 }}>
                                    {inMinutes ? relative.slice(0, -4) : relative}
                                </Text>
                                {inMinutes && <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600' }}>min</Text>}
                            </View>
                            {relative !== clock && <Text style={{ color: theme.muted, fontSize: 12 }}>{clock}</Text>}
                            {d.delaySec !== null && <DepartureDelay delaySec={d.delaySec} />}
                        </>
                    )}
                </View>

                {!d.added && (
                    <ChevronDown size={18} color={theme.muted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
                )}
            </View>
            {open && !d.added && (
                <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.hairline }}>
                    <DepartureTripStops departure={d} />
                </View>
            )}
        </Pressable>
    );
}
