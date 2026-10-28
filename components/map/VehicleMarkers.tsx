import React, { useMemo } from 'react';
import VehicleMarker from '@/components/map/VehicleMarker';
import type { MapVehicle } from '@/services/gtfs/vehicles/vehicleRoutes';

// Every marker is a native view, so draw only the ones nearest the middle of the map.
const MAX_MARKERS = 60;

type Props = { vehicles: MapVehicle[]; center: { latitude: number; longitude: number } | null };

export default function VehicleMarkers({ vehicles, center }: Props) {
    const shown = useMemo(() => {
        if (vehicles.length <= MAX_MARKERS) return vehicles;
        if (!center) return vehicles.slice(0, MAX_MARKERS);
        const cosLat = Math.cos((center.latitude * Math.PI) / 180);
        const distance = (v: MapVehicle) => (v.latitude - center.latitude) ** 2 + ((v.longitude - center.longitude) * cosLat) ** 2;
        return [...vehicles].sort((a, b) => distance(a) - distance(b)).slice(0, MAX_MARKERS);
    }, [vehicles, center]);

    return (
        <>
            {shown.map(v => (
                <VehicleMarker key={v.key} vehicle={v} />
            ))}
        </>
    );
}
