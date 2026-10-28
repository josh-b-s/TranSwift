import type { QueryableDb } from '@/services/db/queryableDb';
import type { PathwayEdge } from './pathwayGraph';
import { buildStationDetail, type NodeInput, type PlatformInput, type StationDetail } from './stationDetail';

/** `unavailable`: the database predates station data, so a fresh import of the feed is needed. */
export type StationResult = { status: 'unavailable' | 'none' } | { status: 'ok'; detail: StationDetail };

const MAX_TOWARD = 4;

type StopRow = {
    stop_pk: number; stop_id: string; stop_name: string; agency: number;
    parent_station: string | null; platform_code: string | null; level_id: string | null;
};

const asPlatform = (r: StopRow): PlatformInput => ({
    stopPk: r.stop_pk, stopId: r.stop_id, name: r.stop_name ?? '', platformCode: r.platform_code, levelId: r.level_id,
});

const placeholders = (n: number) => Array(n).fill('?').join(',');

const STOP_COLUMNS = `s.stop_pk, s.stop_id, s.stop_name, s.agency, p.parent_station, p.platform_code, p.level_id`;

async function loadToward(db: QueryableDb, stopPks: number[]): Promise<Map<number, string[]>> {
    const rows = await db.getAllAsync<{ stop_pk: number; line: string; terminus: string }>(
        `SELECT ps.stop_pk, COALESCE(NULLIF(r.route_short_name, ''), r.route_long_name) AS line, last.stop_name AS terminus
         FROM pattern_stops ps
         JOIN patterns p ON p.pattern_pk = ps.pattern_pk
         JOIN routes r ON r.route_id = p.route_id AND r.agency = p.agency
         JOIN pattern_stops lps ON lps.pattern_pk = ps.pattern_pk
          AND lps.stop_sequence = (SELECT MAX(stop_sequence) FROM pattern_stops WHERE pattern_pk = ps.pattern_pk)
         JOIN stops last ON last.stop_pk = lps.stop_pk
         WHERE ps.stop_pk IN (${placeholders(stopPks.length)}) AND lps.stop_pk != ps.stop_pk
         GROUP BY ps.stop_pk, line, terminus
         ORDER BY line, terminus`,
        stopPks,
    );
    const toward = new Map<number, string[]>();
    for (const r of rows) {
        const list = toward.get(r.stop_pk) ?? [];
        if (list.length < MAX_TOWARD) toward.set(r.stop_pk, [...list, `${r.line} to ${r.terminus}`]);
    }
    return toward;
}

/** Platform, entrance and pathway detail for the station a stop belongs to, or just for the stop on its own. */
export async function loadStationDetail(db: QueryableDb, stopPk: number): Promise<StationResult> {
    const tables = await db.getAllAsync<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'stop_platforms'`);
    if (tables.length === 0) return { status: 'unavailable' };

    const [row] = await db.getAllAsync<StopRow>(
        `SELECT ${STOP_COLUMNS} FROM stops s LEFT JOIN stop_platforms p ON p.stop_pk = s.stop_pk WHERE s.stop_pk = ?`,
        [stopPk],
    );
    if (!row) return { status: 'none' };
    const current = asPlatform(row);

    const siblings = row.parent_station
        ? await db.getAllAsync<StopRow>(
            `SELECT ${STOP_COLUMNS} FROM stop_platforms p JOIN stops s ON s.stop_pk = p.stop_pk WHERE p.parent_station = ? AND s.agency = ?`,
            [row.parent_station, row.agency],
        )
        : [];
    const platforms = siblings.length > 0 ? siblings.map(asPlatform) : [current];

    const nodeRows = row.parent_station
        ? await db.getAllAsync<{ node_id: string; node_name: string | null; location_type: number; level_id: string | null }>(
            `SELECT node_id, node_name, location_type, level_id FROM station_nodes WHERE parent_station = ? AND agency = ?`,
            [row.parent_station, row.agency],
        )
        : [];
    const nodes: NodeInput[] = nodeRows.map(n => ({ nodeId: n.node_id, name: n.node_name, locationType: n.location_type, levelId: n.level_id }));

    const ids = [...platforms.map(p => p.stopId), ...nodes.map(n => n.nodeId)];
    const edgeRows = await db.getAllAsync<{
        from_id: string; to_id: string; mode: number; is_bidirectional: number; length_m: number | null;
        traversal_sec: number | null; stair_count: number | null; signposted_as: string | null; reversed_signposted_as: string | null;
    }>(
        `SELECT from_id, to_id, mode, is_bidirectional, length_m, traversal_sec, stair_count, signposted_as, reversed_signposted_as
         FROM pathways WHERE agency = ? AND (from_id IN (${placeholders(ids.length)}) OR to_id IN (${placeholders(ids.length)}))`,
        [row.agency, ...ids, ...ids],
    );
    const edges: PathwayEdge[] = edgeRows.map(e => ({
        fromId: e.from_id, toId: e.to_id, mode: e.mode, bidirectional: e.is_bidirectional === 1, lengthM: e.length_m,
        seconds: e.traversal_sec, stairCount: e.stair_count, signpost: e.signposted_as, reverseSignpost: e.reversed_signposted_as,
    }));

    const hasStationInfo = row.parent_station || row.platform_code || row.level_id || edges.length > 0;
    if (!hasStationInfo) return { status: 'none' };

    const levels = await db.getAllAsync<{ level_id: string; level_name: string | null }>(
        `SELECT level_id, level_name FROM levels WHERE agency = ?`,
        [row.agency],
    );
    const stationName = row.parent_station
        ? (await db.getAllAsync<{ node_name: string | null }>(`SELECT node_name FROM station_nodes WHERE node_id = ? AND agency = ?`, [row.parent_station, row.agency]))[0]?.node_name ?? null
        : null;

    const detail = buildStationDetail({
        stationName,
        current,
        platforms,
        nodes,
        levelNames: new Map(levels.flatMap(l => (l.level_name ? [[l.level_id, l.level_name] as const] : []))),
        edges,
        toward: await loadToward(db, platforms.map(p => p.stopPk)),
    });
    return { status: 'ok', detail };
}
