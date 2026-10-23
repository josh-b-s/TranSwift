import { Ionicons } from '@expo/vector-icons';
import type { RouteCategory } from '@/services/gtfs/config/routeTypeUtil';

type IconName = keyof typeof Ionicons.glyphMap;

const MODE_ICONS: Record<RouteCategory, IconName> = {
    tram: 'train-outline',
    metro: 'subway-outline',
    rail: 'subway-outline',
    bus: 'bus-outline',
    coach: 'bus-outline',
    ferry: 'boat-outline',
    cable: 'navigate-outline',
    aerial: 'navigate-outline',
    funicular: 'navigate-outline',
    other: 'navigate-outline',
};

export const modeIcon = (category: RouteCategory): IconName => MODE_ICONS[category];
