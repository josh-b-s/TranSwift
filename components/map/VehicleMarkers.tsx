import React, { useMemo } from 'react';
import VehicleMarker from '@/components/map/VehicleMarker';
import type { MapVehicle } from '@/services/gtfs/vehicles/vehicleRoutes';

// Every marker is a native view, so draw only the ones nearest the middle of the map.
const MAX_MARKERS = 60;

type Center = { latitude: number; longitude: number } | null;

function nearest(vehicles: MapVehicle[], center: Center): MapVehicle[] {
    if (vehicles.length <= MAX_MARKERS) return vehicles;
    if (!center) return vehicles.slice(0, MAX_MARKERS);
    const cosLat = Math.cos((center.latitude * Math.PI) / 180);
    const distance = (v: MapVehicle) => (v.latitude - center.latitude) ** 2 + ((v.longitude - center.longitude) * cosLat) ** 2;
    return [...vehicles].sort((a, b) => distance(a) - distance(b)).slice(0, MAX_MARKERS);
}

type Props = {
    vehicles: MapVehicle[];
    center: Center;
    /** The feed's trip id of the vehicle to highlight. */
    selectedTripId: string | null;
    onPress: (vehicle: MapVehicle) => void;
};

export default function VehicleMarkers({ vehicles, center, selectedTripId, onPress }: Props) {
    const shown = useMemo(() => {
        const close = nearest(vehicles, center);
        // The highlighted vehicle stays drawn however far from the middle of the map it is.
        const selected = selectedTripId === null ? undefined : vehicles.find(v => v.tripId === selectedTripId);
        return selected && !close.includes(selected) ? [...close, selected] : close;
    }, [vehicles, center, selectedTripId]);

    return (
        <>
            {shown.map(v => (
                <VehicleMarker key={v.key} vehicle={v} selected={selectedTripId !== null && v.tripId === selectedTripId} onPress={onPress} />
            ))}
        </>
    );
}
