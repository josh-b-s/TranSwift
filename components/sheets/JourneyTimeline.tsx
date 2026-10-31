import React from 'react';
import { Text, View } from 'react-native';
import { ACCENT, WARNING, useThemeStyle } from '@/constants/themes';
import { formatBoardingDelay, formatJourneyClock } from '@/services/gtfs/router/journeyFormat';
import type { GtfsJourney } from '@/services/gtfs/router/routeTypes';

/** Board and alight stops of every ride, joined by a line in the route's colour. */
export default function JourneyTimeline({ legs }: { legs: GtfsJourney['legs'] }) {
    const theme = useThemeStyle();
    const gapLine = theme.color + '22';

    return (
        <View>
            {legs.map((leg, i) => {
                const color = leg.routeColor ?? ACCENT;
                const isLast = i === legs.length - 1;
                const delay = formatBoardingDelay(leg.departureDelaySec);
                return (
                    <React.Fragment key={i}>
                        <Row
                            dot={color}
                            line={color}
                            time={leg.departureTime ? formatJourneyClock(leg.departureTime) : undefined}
                            note={delay ?? undefined}
                            noteColor={WARNING}
                            title={leg.originStopName}
                            caption={`Board ${leg.routeName}`}
                        />
                        <Row
                            dot={color}
                            line={isLast ? undefined : gapLine}
                            time={leg.arrivalTime ? formatJourneyClock(leg.arrivalTime) : undefined}
                            title={leg.destStopName}
                            caption="Get off"
                        />
                    </React.Fragment>
                );
            })}
        </View>
    );
}

const TIME_WIDTH = 66;
const RAIL_WIDTH = 16;

function Row({ dot, line, time, note, noteColor, title, caption }: {
    dot: string;
    line?: string;
    time?: string;
    note?: string;
    noteColor?: string;
    title: string;
    caption?: string;
}) {
    const theme = useThemeStyle();
    return (
        <View style={{ flexDirection: 'row' }}>
            <View style={{ width: TIME_WIDTH, alignItems: 'flex-end', paddingRight: 10 }}>
                {!!time && <Text style={{ color: theme.color, fontSize: 13, fontWeight: '600' }}>{time}</Text>}
                {!!note && <Text style={{ color: noteColor, fontSize: 11, fontWeight: '600' }}>{note}</Text>}
            </View>
            <View style={{ width: RAIL_WIDTH, alignItems: 'center' }}>
                <View
                    style={{
                        width: 12, height: 12, borderRadius: 6, marginTop: 2,
                        borderWidth: 3, borderColor: dot, backgroundColor: dot,
                    }}
                />
                {line && <View style={{ width: 3, flex: 1, borderRadius: 2, backgroundColor: line, marginVertical: 2 }} />}
            </View>
            <View style={{ flex: 1, paddingLeft: 10, paddingBottom: line ? 14 : 0, minHeight: 20 }}>
                <Text numberOfLines={2} style={{ color: theme.color, fontSize: 14, fontWeight: '600' }}>
                    {title}
                </Text>
                {!!caption && <Text style={{ color: theme.muted, fontSize: 12, marginTop: 1 }}>{caption}</Text>}
            </View>
        </View>
    );
}
