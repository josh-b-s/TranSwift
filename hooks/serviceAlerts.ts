import { useEffect, useState } from 'react';
import { getDb } from '@/services/db/sqliteDb';
import { resolveActiveAlerts } from '@/services/gtfs/alerts/alertRoutes';
import type { ResolvedAlert } from '@/services/gtfs/alerts/serviceAlert';
import { fetchServiceAlerts } from '@/services/gtfs/realtime/serviceAlerts';

const REFRESH_MS = 60_000;
const NONE: ResolvedAlert[] = [];

/**
 * The service alerts in effect now, refreshed every minute while `enabled`. Empty when the feed has no
 * ServiceAlerts URLs. A failed refresh is logged and the last alerts stay.
 */
export function useServiceAlerts(enabled: boolean): ResolvedAlert[] {
    const [alerts, setAlerts] = useState<ResolvedAlert[]>(NONE);

    useEffect(() => {
        if (!enabled) {
            setAlerts(NONE);
            return;
        }
        let cancelled = false;

        const refresh = async () => {
            try {
                const resolved = await resolveActiveAlerts(await getDb(), await fetchServiceAlerts(), Date.now());
                if (!cancelled) setAlerts(resolved.length > 0 ? resolved : NONE);
            } catch (err) {
                console.warn('[serviceAlerts] refresh failed, keeping the last alerts:', err);
            }
        };

        refresh();
        const timer = setInterval(refresh, REFRESH_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [enabled]);

    return alerts;
}
