import { Bus, CableCar, Navigation, Ship, TrainFront, TramFront } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { RouteCategory } from '@/services/gtfs/config/routeTypeUtil';

const MODE_ICONS: Record<RouteCategory, LucideIcon> = {
    tram: TramFront,
    metro: TrainFront,
    rail: TrainFront,
    bus: Bus,
    coach: Bus,
    ferry: Ship,
    cable: CableCar,
    aerial: CableCar,
    funicular: CableCar,
    other: Navigation,
};

export const modeIcon = (category: RouteCategory): LucideIcon => MODE_ICONS[category];
