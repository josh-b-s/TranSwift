import React from 'react';
import { Marker } from 'react-native-maps';
import { useSimulation } from '@/hooks/simulation';

export default function SimulatedLocationMarker() {
    const simulation = useSimulation();
    if (!simulation) return null;
    return <Marker coordinate={simulation.position} pinColor="orange" title="Simulated location" />;
}
