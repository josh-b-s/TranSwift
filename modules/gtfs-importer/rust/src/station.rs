//! Station detail: platform codes, entrances and other station nodes, pathways and levels. Read from the same
//! stops.txt the stops table comes from, plus pathways.txt and levels.txt, and stored in tables of their own.

use std::collections::HashMap;
use rusqlite::{params, Connection};
use crate::csv_util::parse_csv_map;
use crate::import::ImportProgress;
use crate::source::GtfsSource;

const MIN_PATHWAY_MODE: i64 = 1;
const MAX_PATHWAY_MODE: i64 = 7;

fn text(row: &HashMap<String, String>, key: &str) -> String {
    row.get(key).cloned().unwrap_or_default()
}

/// None for a blank cell, so a missing value stays NULL instead of becoming zero.
fn number<T: std::str::FromStr>(row: &HashMap<String, String>, key: &str) -> Option<T> {
    row.get(key).filter(|v| !v.is_empty()).and_then(|v| v.parse().ok())
}

fn nullable(value: String) -> Option<String> {
    if value.is_empty() { None } else { Some(value) }
}

/// Imports one agency's station data. `stop_id_to_pk` maps the boarding stops the stops table kept.
pub fn import_station_data(
    conn: &Connection,
    agency_id: i64,
    source: &GtfsSource,
    stop_id_to_pk: &HashMap<String, i64>,
    progress: &dyn ImportProgress,
) -> rusqlite::Result<()> {
    let mut ins_platform = conn.prepare(
        "INSERT OR IGNORE INTO stop_platforms (stop_pk,parent_station,platform_code,level_id) VALUES (?,?,?,?)",
    )?;
    let mut ins_node = conn.prepare(
        "INSERT OR IGNORE INTO station_nodes (node_id,agency,node_name,location_type,parent_station,level_id,platform_code,node_lat,node_lon) VALUES (?,?,?,?,?,?,?,?,?)",
    )?;
    let mut platforms = 0u64;
    let mut nodes = 0u64;
    for r in parse_csv_map(&source.file("stops.txt")) {
        let stop_id = text(&r, "stop_id");
        let location_type: i64 = number(&r, "location_type").unwrap_or(0);
        let parent = text(&r, "parent_station");
        let platform_code = text(&r, "platform_code");
        let level_id = text(&r, "level_id");
        if location_type == 0 {
            let Some(&stop_pk) = stop_id_to_pk.get(&stop_id) else { continue };
            if parent.is_empty() && platform_code.is_empty() && level_id.is_empty() { continue; }
            ins_platform.execute(params![stop_pk, nullable(parent), nullable(platform_code), nullable(level_id)])?;
            platforms += 1;
        } else if (1..=4).contains(&location_type) && !stop_id.is_empty() {
            let coord = |key: &str| number::<f64>(&r, key).map(|v| (v * 1_000_000.0).round() as i64);
            ins_node.execute(params![
                stop_id, agency_id, nullable(text(&r, "stop_name")), location_type,
                nullable(parent), nullable(level_id), nullable(platform_code), coord("stop_lat"), coord("stop_lon"),
            ])?;
            nodes += 1;
        }
    }
    progress.on_progress(format!("agency {agency_id} · platforms"), platforms, platforms)?;
    progress.on_progress(format!("agency {agency_id} · station nodes"), nodes, nodes)?;

    let mut ins_pathway = conn.prepare(
        "INSERT OR IGNORE INTO pathways (pathway_id,agency,from_id,to_id,mode,is_bidirectional,length_m,traversal_sec,stair_count,signposted_as,reversed_signposted_as) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    )?;
    let mut pathways = 0u64;
    for r in parse_csv_map(&source.file("pathways.txt")) {
        let (from_id, to_id) = (text(&r, "from_stop_id"), text(&r, "to_stop_id"));
        let Some(mode) = number::<i64>(&r, "pathway_mode").filter(|m| (MIN_PATHWAY_MODE..=MAX_PATHWAY_MODE).contains(m)) else { continue };
        if from_id.is_empty() || to_id.is_empty() { continue; }
        ins_pathway.execute(params![
            text(&r, "pathway_id"), agency_id, from_id, to_id, mode,
            number::<i64>(&r, "is_bidirectional").unwrap_or(0),
            number::<f64>(&r, "length"), number::<i64>(&r, "traversal_time"), number::<i64>(&r, "stair_count"),
            nullable(text(&r, "signposted_as")), nullable(text(&r, "reversed_signposted_as")),
        ])?;
        pathways += 1;
    }
    progress.on_progress(format!("agency {agency_id} · pathways"), pathways, pathways)?;

    let mut ins_level = conn.prepare("INSERT OR IGNORE INTO levels (level_id,agency,level_index,level_name) VALUES (?,?,?,?)")?;
    let mut levels = 0u64;
    for r in parse_csv_map(&source.file("levels.txt")) {
        let level_id = text(&r, "level_id");
        if level_id.is_empty() { continue; }
        ins_level.execute(params![level_id, agency_id, number::<f64>(&r, "level_index"), nullable(text(&r, "level_name"))])?;
        levels += 1;
    }
    progress.on_progress(format!("agency {agency_id} · levels"), levels, levels)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::io::{Cursor, Write};
    use super::*;
    use crate::import::import_gtfs;

    struct Silent;
    impl ImportProgress for Silent {
        fn on_progress(&self, _: String, _: u64, _: u64) -> rusqlite::Result<()> { Ok(()) }
    }

    const FEED: &[(&str, &str)] = &[
        ("agency.txt", "agency_id,agency_name,agency_url,agency_timezone\nA,Metro,http://x,Australia/Melbourne\n"),
        ("stops.txt", "stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station,platform_code,level_id\n\
            ST,Central Station,-37.81,144.96,1,,,\n\
            P1,Central Platform 1,-37.8101,144.9601,0,ST,1,L1\n\
            P2,Central Platform 2,-37.8102,144.9602,0,ST,2,L1\n\
            LOOSE,Plain Stop,-37.82,144.97,0,,,\n\
            EX1,Swanston St exit,-37.8103,144.9603,2,ST,,L0\n\
            EX2,Elizabeth St exit,,,2,ST,,L0\n\
            GN,Concourse,-37.81,144.96,3,ST,,L0\n"),
        ("levels.txt", "level_id,level_index,level_name\nL0,0,Concourse\nL1,-1,Platforms\n"),
        ("pathways.txt", "pathway_id,from_stop_id,to_stop_id,pathway_mode,is_bidirectional,length,traversal_time,stair_count,signposted_as,reversed_signposted_as\n\
            w1,P1,GN,4,0,,25,,Up to concourse,\n\
            w2,GN,EX1,1,1,40,35,,Swanston St,To platforms\n\
            w3,GN,P2,9,1,,,,,\n\
            w4,GN,,1,1,,,,,\n"),
        ("routes.txt", "route_id,route_short_name,route_long_name,route_type\nR,1,One,1\n"),
        ("calendar.txt", "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nS,1,1,1,1,1,1,1,20260101,20271231\n"),
        ("trips.txt", "route_id,service_id,trip_id,trip_headsign\nR,S,T,Brunswick\n"),
        ("stop_times.txt", "trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT,08:00:00,08:00:00,P1,1\nT,08:10:00,08:10:00,LOOSE,2\n"),
    ];

    fn import_feed() -> Connection {
        let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
        for (name, body) in FEED {
            zip.start_file(*name, zip::write::FileOptions::default()).unwrap();
            zip.write_all(body.as_bytes()).unwrap();
        }
        let bytes = zip.finish().unwrap().into_inner();
        let dir = std::env::temp_dir().join(format!("gtfs-station-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let (zip_path, db_path) = (dir.join("feed.zip"), dir.join("feed.db"));
        let _ = std::fs::remove_file(&db_path);
        std::fs::write(&zip_path, bytes).unwrap();
        import_gtfs(zip_path.to_str().unwrap(), db_path.to_str().unwrap(), &Silent).unwrap();
        Connection::open(db_path).unwrap()
    }

    #[test]
    fn imports_platforms_nodes_pathways_and_levels() {
        let conn = import_feed();

        let platforms: Vec<(String, Option<String>, Option<String>, Option<String>)> = conn
            .prepare("SELECT s.stop_id, p.parent_station, p.platform_code, p.level_id FROM stop_platforms p JOIN stops s ON s.stop_pk = p.stop_pk ORDER BY s.stop_id")
            .unwrap().query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))).unwrap().map(Result::unwrap).collect();
        assert_eq!(platforms, vec![
            ("P1".into(), Some("ST".into()), Some("1".into()), Some("L1".into())),
            ("P2".into(), Some("ST".into()), Some("2".into()), Some("L1".into())),
        ]);

        let nodes: Vec<(String, i64, Option<String>, Option<i64>)> = conn
            .prepare("SELECT node_id, location_type, parent_station, node_lat FROM station_nodes ORDER BY node_id")
            .unwrap().query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))).unwrap().map(Result::unwrap).collect();
        assert_eq!(nodes, vec![
            ("EX1".into(), 2, Some("ST".into()), Some(-37_810_300)),
            ("EX2".into(), 2, Some("ST".into()), None), // no coordinates stays NULL
            ("GN".into(), 3, Some("ST".into()), Some(-37_810_000)),
            ("ST".into(), 1, None, Some(-37_810_000)),
        ]);

        // Rows with an unknown mode or a missing end are dropped.
        let pathways: i64 = conn.query_row("SELECT COUNT(*) FROM pathways", [], |r| r.get(0)).unwrap();
        assert_eq!(pathways, 2);
        let w2: (i64, i64, Option<f64>, Option<i64>, Option<String>, Option<String>) = conn
            .query_row("SELECT mode, is_bidirectional, length_m, traversal_sec, signposted_as, reversed_signposted_as FROM pathways WHERE pathway_id = 'w2'", [], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?))).unwrap();
        assert_eq!(w2, (1, 1, Some(40.0), Some(35), Some("Swanston St".into()), Some("To platforms".into())));
        let w1: (Option<f64>, Option<i64>) = conn.query_row("SELECT length_m, stair_count FROM pathways WHERE pathway_id = 'w1'", [], |r| Ok((r.get(0)?, r.get(1)?))).unwrap();
        assert_eq!(w1, (None, None));

        let levels: Vec<(String, Option<f64>, Option<String>)> = conn
            .prepare("SELECT level_id, level_index, level_name FROM levels ORDER BY level_id")
            .unwrap().query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?))).unwrap().map(Result::unwrap).collect();
        assert_eq!(levels, vec![("L0".into(), Some(0.0), Some("Concourse".into())), ("L1".into(), Some(-1.0), Some("Platforms".into()))]);
    }

    #[test]
    fn keeps_the_trip_headsign() {
        let conn = import_feed();
        let headsign: Option<String> = conn.query_row("SELECT trip_headsign FROM trips WHERE trip_id = 'T'", [], |r| r.get(0)).unwrap();
        assert_eq!(headsign, Some("Brunswick".into()));
    }

    #[test]
    fn the_stops_table_still_holds_only_boarding_stops() {
        let conn = import_feed();
        let ids: Vec<String> = conn.prepare("SELECT stop_id FROM stops ORDER BY stop_id").unwrap()
            .query_map([], |r| r.get(0)).unwrap().map(Result::unwrap).collect();
        assert_eq!(ids, vec!["LOOSE", "P1", "P2"]);
    }
}
