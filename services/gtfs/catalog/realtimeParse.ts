import { parseCsv } from './csvParse';

export type RealtimeAuth = { kind: 'query' | 'header'; name: string };

export type RealtimeEndpoints = {
    tripUpdates: string[];
    vehiclePositions: string[];
    /** Set when the producer wants the user's own key; the URLs are listed without it. */
    auth: RealtimeAuth | null;
};

// Like the box columns, these are optional: if a name is wrong the lookup finds nothing instead of failing.
const COLUMN = {
    dataType: 'data_type',
    status: 'status',
    entityType: 'entity_type',
    staticRef: 'static_reference',
    url: 'urls.direct_download',
    authType: 'urls.authentication_type',
    authParam: 'urls.api_key_parameter_name',
} as const;

const bareId = (id: string) => id.trim().replace(/^mdb-/i, '');

/** The realtime rows the catalog CSV lists against one schedule feed id. */
export function parseRealtimeEndpoints(text: string, staticId: string): RealtimeEndpoints {
    const result: RealtimeEndpoints = { tripUpdates: [], vehiclePositions: [], auth: null };
    const [header, ...rows] = parseCsv(text);
    if (!header) return result;

    const index = new Map(header.map((h, i) => [h.trim(), i]));
    if (!index.has(COLUMN.url) || !index.has(COLUMN.entityType) || !index.has(COLUMN.staticRef)) return result;

    const cell = (row: string[], col: keyof typeof COLUMN) => (row[index.get(COLUMN[col]) ?? -1] ?? '').trim();
    const wanted = bareId(staticId);

    for (const row of rows) {
        if (!/^gtfs[-_]rt$/i.test(cell(row, 'dataType'))) continue;
        const status = cell(row, 'status');
        if (status !== '' && status !== 'active') continue;
        if (!cell(row, 'staticRef').split(/[\s,;|]+/).some((ref) => ref && bareId(ref) === wanted)) continue;

        const url = cell(row, 'url');
        if (!url) continue;

        const types = cell(row, 'entityType').toLowerCase().split(/[^a-z]+/);
        if (types.includes('tu') && !result.tripUpdates.includes(url)) result.tripUpdates.push(url);
        if (types.includes('vp') && !result.vehiclePositions.includes(url)) result.vehiclePositions.push(url);

        const authType = cell(row, 'authType');
        const authName = cell(row, 'authParam');
        if (!result.auth && authName && (authType === '1' || authType === '2')) {
            result.auth = { kind: authType === '1' ? 'query' : 'header', name: authName };
        }
    }
    return result;
}
