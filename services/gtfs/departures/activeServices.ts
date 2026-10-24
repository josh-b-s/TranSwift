import type { QueryableDb } from '@/services/db/sqlChunkUtil';
import { makeKey } from '@/services/gtfs/core/gtfsKeyUtil';

const DOW_COLUMNS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function toGtfsDate(d: Date): string {
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}${month}${day}`;
}

/** Agency-qualified keys of the services that run on the given calendar day. */
export async function getActiveServiceKeys(db: QueryableDb, day: Date): Promise<Set<string>> {
    const date = toGtfsDate(day);
    const [calendarRows, exceptionRows] = await Promise.all([
        db.getAllAsync<{ service_id: string; agency: number }>(
            `SELECT service_id, agency
             FROM calendar
             WHERE ${DOW_COLUMNS[day.getDay()]} = 1
               AND start_date <= ?
               AND end_date >= ?`,
            [date, date],
        ),
        db.getAllAsync<{ service_id: string; agency: number; exception_type: number }>(
            `SELECT service_id, agency, exception_type
             FROM calendar_dates
             WHERE date = ?`,
            [date],
        ),
    ]);

    const active = new Set<string>();
    for (const r of calendarRows) active.add(makeKey(r.agency, r.service_id));
    for (const r of exceptionRows) {
        const key = makeKey(r.agency, r.service_id);
        if (r.exception_type === 1) active.add(key);
        else if (r.exception_type === 2) active.delete(key);
    }
    return active;
}
