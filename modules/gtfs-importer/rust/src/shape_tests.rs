use std::io::{Cursor, Write};
use std::sync::atomic::{AtomicUsize, Ordering};
use rusqlite::Connection;
use crate::import::{import_gtfs, ImportProgress};
use crate::shape_codec::encode_shape;
use crate::stop_time_codec::{encode_chunk, StopTimeRow};

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
    static NEXT: AtomicUsize = AtomicUsize::new(0);
    let dir = std::env::temp_dir().join(format!("gtfs-shape-test-{}-{}", std::process::id(), NEXT.fetch_add(1, Ordering::Relaxed)));
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
    assert_eq!(stored, vec![used.clone()]);
    let blobs: Vec<Vec<u8>> = conn.prepare("SELECT points FROM shapes").unwrap()
        .query_map([], |r| r.get(0)).unwrap().map(Result::unwrap).collect();
    let middle = if used == "SH1" { (-37_815_000, 144_965_000) } else { (-37_816_000, 144_966_000) };
    assert_eq!(blobs, vec![encode_shape(&[(-37_810_000, 144_960_000), middle, (-37_820_000, 144_970_000)])]);
}

#[test]
fn every_stop_call_is_stored_in_its_stops_chunk() {
    let conn = import_feed();
    let pk = |sql: &str, id: &str| -> i64 { conn.query_row(sql, [id], |r| r.get(0)).unwrap() };
    let (t1, t2) = (pk("SELECT trip_pk FROM trips WHERE trip_id = ?", "T1"), pk("SELECT trip_pk FROM trips WHERE trip_id = ?", "T2"));
    let call = |departure_sec, trip_pk, stop_sequence| StopTimeRow { departure_sec, trip_pk, stop_sequence, dwell_sec: 0, pickup_type: 0, drop_off_type: 0 };
    for (stop_id, rows) in [
        ("A", [call(8 * 3600, t1, 1), call(9 * 3600, t2, 1)]),
        ("B", [call(8 * 3600 + 600, t1, 2), call(9 * 3600 + 600, t2, 2)]),
    ] {
        let stop_pk = pk("SELECT stop_pk FROM stops WHERE stop_id = ?", stop_id);
        let chunks: Vec<(i64, i64, Vec<u8>)> = conn.prepare("SELECT first_dep, chunk_idx, data FROM stop_time_chunks WHERE stop_pk = ?").unwrap()
            .query_map([stop_pk], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?))).unwrap().map(Result::unwrap).collect();
        assert_eq!(chunks, vec![(rows[0].departure_sec, 0, encode_chunk(rows[0].departure_sec, &rows))], "stop {stop_id}");
    }
}
