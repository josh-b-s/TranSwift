use std::io::{Cursor, Write};
use rusqlite::Connection;
use crate::import::{import_gtfs, ImportProgress};

struct Silent;
impl ImportProgress for Silent {
    fn on_progress(&self, _: String, _: u64, _: u64) -> rusqlite::Result<()> { Ok(()) }
}

const FEED: &[(&str, &str)] = &[
    ("agency.txt", "agency_id,agency_name,agency_url,agency_timezone\n1,A,http://a,Australia/Melbourne\n"),
    ("stops.txt", "stop_id,stop_name,stop_lat,stop_lon\nA,A,-37.81,144.96\nB,B,-37.82,144.97\n"),
    ("routes.txt", "route_id,route_short_name,route_long_name,route_type\nR,1,One,3\n"),
    ("calendar.txt", "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nS,1,1,1,1,1,1,1,20260101,20271231\n"),
    ("trips.txt", "route_id,service_id,trip_id,shape_id\nR,S,T1,SH1\nR,S,T2,SH2\n"),
    ("stop_times.txt", "trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT1,08:00:00,08:00:00,A,1\nT1,08:10:00,08:10:00,B,2\nT2,09:00:00,09:00:00,A,1\nT2,09:10:00,09:10:00,B,2\n"),
    ("shapes.txt", "shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\n\
        SH1,-37.810,144.960,1\nSH1,-37.815,144.965,2\nSH1,-37.820,144.970,3\n\
        SH2,-37.810,144.960,1\nSH2,-37.816,144.966,2\nSH2,-37.820,144.970,3\n\
        SH3,-37.810,144.960,1\nSH3,-37.817,144.967,2\nSH3,-37.820,144.970,3\n"),
];

fn import_feed() -> Connection {
    let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
    for (name, body) in FEED {
        zip.start_file(*name, zip::write::FileOptions::default()).unwrap();
        zip.write_all(body.as_bytes()).unwrap();
    }
    let bytes = zip.finish().unwrap().into_inner();
    let dir = std::env::temp_dir().join(format!("gtfs-shape-test-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let (zip_path, db_path) = (dir.join("feed.zip"), dir.join("feed.db"));
    let _ = std::fs::remove_file(&db_path);
    std::fs::write(&zip_path, bytes).unwrap();
    import_gtfs(zip_path.to_str().unwrap(), db_path.to_str().unwrap(), &Silent).unwrap();
    Connection::open(db_path).unwrap()
}

#[test]
fn only_the_shape_a_pattern_uses_is_stored() {
    let conn = import_feed();
    let used: String = conn.query_row("SELECT shape_id FROM patterns", [], |r| r.get(0)).unwrap();
    let stored: Vec<String> = conn.prepare("SELECT shape_id FROM shape_meta").unwrap()
        .query_map([], |r| r.get(0)).unwrap().map(Result::unwrap).collect();
    assert_eq!(stored, vec![used]);
    let points: i64 = conn.query_row("SELECT COUNT(*) FROM shapes", [], |r| r.get(0)).unwrap();
    assert_eq!(points, 3);
}
