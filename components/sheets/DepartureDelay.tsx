import React from 'react';
import { Text } from 'react-native';
import { formatDelay } from '@/services/gtfs/departures/departureFormat';

const LATE = '#d97706';
const ON_TIME = '#16a34a';

/** "4 min late" in amber, "On time" or "2 min early" in green. */
export default function DepartureDelay({ delaySec }: { delaySec: number }) {
    const late = Math.round(delaySec / 60) > 0;
    return <Text style={{ color: late ? LATE : ON_TIME, fontSize: 12, fontWeight: '600' }}>{formatDelay(delaySec)}</Text>;
}
