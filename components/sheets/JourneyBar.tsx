import React from 'react';
import { Text, View } from 'react-native';
import { ChevronRight, Footprints } from 'lucide-react-native';
import { ACCENT, useThemeStyle } from '@/constants/themes';
import { modeIcon } from '@/constants/modeIcons';
import { classifyRouteType } from '@/services/gtfs/core/routeTypeUtil';
import { walkSecondsByGap } from '@/services/gtfs/router/walkTimes';
import type { GtfsJourney } from '@/services/gtfs/router/routeTypes';

const PILL_HEIGHT = 30;

/** The journey as a chain: each ride as a pill with its icon and line, each walk with its time. Wraps onto more lines when it is long. */
export default function JourneyBar({ journey, walkingSpeedMps }: { journey: GtfsJourney; walkingSpeedMps: number }) {
    const theme = useThemeStyle();
    const walks = walkSecondsByGap(journey, walkingSpeedMps);

    const steps: React.ReactNode[] = [];
    const walk = (seconds: number | null, key: string) => {
        if (!seconds) return;
        steps.push(
            <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: PILL_HEIGHT }}>
                <Footprints size={14} color={theme.muted} />
                <Text style={{ color: theme.muted, fontSize: 13, fontWeight: '600' }}>{Math.max(1, Math.round(seconds / 60))} min</Text>
            </View>,
        );
    };

    journey.legs.forEach((leg, i) => {
        walk(walks[i], `walk-${i}`);
        const textColor = leg.routeTextColor ?? '#fff';
        const ModeIcon = modeIcon(classifyRouteType(leg.routeType).category);
        steps.push(
            <View
                key={`ride-${i}`}
                style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5, height: PILL_HEIGHT, paddingHorizontal: 11,
                    borderRadius: PILL_HEIGHT / 2, backgroundColor: leg.routeColor ?? ACCENT,
                }}
            >
                <ModeIcon size={14} color={textColor} />
                <Text style={{ color: textColor, fontSize: 13, fontWeight: '700' }}>{leg.routeName}</Text>
            </View>,
        );
    });
    walk(walks[journey.legs.length], 'walk-end');

    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 4, rowGap: 6 }}>
            {/* The arrow travels with the step before it, so a wrap never leaves one at the start of a line. */}
            {steps.map((step, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {step}
                    {i < steps.length - 1 && <ChevronRight size={14} color={theme.muted} />}
                </View>
            ))}
        </View>
    );
}
