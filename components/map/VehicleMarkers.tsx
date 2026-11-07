import React, { useMemo } from 'react';
import VehicleArrowMarker from '@/components/map/VehicleArrowMarker';
import VehicleMarker from '@/components/map/VehicleMarker';
import type { MapVehicle } from '@/services/gtfs/vehicles/vehicleRoutes';
import { bearingBucket } from '@/services/gtfs/vehicles/vehicleBearing';

// Every marker, and each arrow, is a native view, so draw only the ones nearest the middle of the map.
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
    /** Whether to draw only the vehicles nearest `center`. The few left zoomed out are on the picked trip's line. */
    capped: boolean;
    /** The feed's trip id of the vehicle to highlight. */
    selectedTripId: string | null;
    /** Where the highlighted vehicle's trip ends. */
    selectedTerminus: string | null;
    onPress: (vehicle: MapVehicle) => void;
};

export default function VehicleMarkers({ vehicles, center, capped, selectedTripId, selectedTerminus, onPress }: Props) {
    const shown = useMemo(() => {
        const close = capped ? nearest(vehicles, center) : vehicles;
        // The highlighted vehicle stays drawn however far from the middle of the map it is.
        const selected = selectedTripId === null ? undefined : vehicles.find(v => v.tripId === selectedTripId);
        return selected && !close.includes(selected) ? [...close, selected] : close;
    }, [vehicles, center, capped, selectedTripId]);

    return (
        <>
            {shown.map(v => {
                const selected = selectedTripId !== null && v.tripId === selectedTripId;
                const bearing = bearingBucket(v.bearing);
                return (
                    <React.Fragment key={v.key}>
                        {bearing !== null && <VehicleArrowMarker vehicle={v} bearing={bearing} selected={selected} onPress={onPress} />}
                        <VehicleMarker vehicle={v} selected={selected} terminus={selected ? selectedTerminus : null} onPress={onPress} />
                    </React.Fragment>
                );
            })}
        </>
    );
}
