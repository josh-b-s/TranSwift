//! Per-trip delays and cancellations, keyed by trip_pk so the loader can
//! apply them while it builds StopTimeEntry rows.

use std::collections::HashMap;
use prost::Message;
use rusqlite::Connection;
use super::feed::{FeedMessage, StopTimeUpdate, TRIP_CANCELED};

#[derive(Debug, thiserror::Error)]
pub enum OverlayError {
    #[error("could not decode realtime feed: {0}")]
    Decode(#[from] prost::DecodeError),
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
}

/// Delay that takes effect at `stop_sequence` and holds until the next point.
#[derive(Debug, Clone, Copy)]
struct DelayPoint {
    stop_sequence: i64,
    arrival_delay_sec: i64,
    departure_delay_sec: i64,
}

enum TripRealtime {
    Cancelled,
    Delays(Vec<DelayPoint>), // sorted by stop_sequence
}

/// What one feed contained, for diagnosing id mismatches with the timetable.
#[derive(Debug, Default, Clone)]
pub struct FeedStats {
    /// Trip updates in the feed.
    pub trip_updates: usize,
    /// Updates whose trip_id is not in the timetable DB.
    pub unmatched: usize,
    /// Trips that ended up with usable delay or cancellation data.
    pub applied: usize,
    pub sample_unmatched_trip_id: Option<String>,
}

#[derive(Default)]
pub struct Overlay {
    trips: HashMap<i64, TripRealtime>,
}

impl Overlay {
    #[cfg(test)]
    pub fn trip_count(&self) -> usize {
        self.trips.len()
    }

    pub fn is_cancelled(&self, trip_pk: i64) -> bool {
        matches!(self.trips.get(&trip_pk), Some(TripRealtime::Cancelled))
    }

    /// Returns (arrival_sec, departure_sec, departure_delay_sec) with the
    /// trip's delay at this stop applied. Stops before a trip's first
    /// update keep their scheduled times.
    pub fn apply(&self, trip_pk: i64, stop_sequence: i64, arrival_sec: i64, departure_sec: i64) -> (i64, i64, i64) {
        let Some(TripRealtime::Delays(points)) = self.trips.get(&trip_pk) else {
            return (arrival_sec, departure_sec, 0);
        };
        let idx = points.partition_point(|p| p.stop_sequence <= stop_sequence);
        let Some(p) = idx.checked_sub(1).map(|i| points[i]) else {
            return (arrival_sec, departure_sec, 0);
        };
        (arrival_sec + p.arrival_delay_sec, departure_sec + p.departure_delay_sec, p.departure_delay_sec)
    }

    /// Merges several feeds (e.g. one per transport mode) into one overlay.
    /// Later feeds win if two update the same trip. Also returns how many
    /// trips each feed matched, in input order.
    pub fn from_feeds(feeds: &[Vec<u8>], conn: &Connection) -> Result<(Self, Vec<FeedStats>), OverlayError> {
        let mut merged = Self::default();
        let mut per_feed = Vec::with_capacity(feeds.len());
        for bytes in feeds {
            let (overlay, stats) = Self::from_feed(bytes, conn)?;
            per_feed.push(stats);
            merged.trips.extend(overlay.trips);
        }
        Ok((merged, per_feed))
    }

    /// Decodes a TripUpdates feed and resolves its text ids against the
    /// timetable DB. Updates that only carry absolute times (no `delay`)
    /// are ignored.
    pub fn from_feed(bytes: &[u8], conn: &Connection) -> Result<(Self, FeedStats), OverlayError> {
        let feed = FeedMessage::decode(bytes)?;
        let mut trip_lookup = conn.prepare("SELECT trip_pk, pattern_pk, agency FROM trips WHERE trip_id = ?1")?;
        let mut seq_lookup = conn.prepare(
            "SELECT ps.stop_sequence FROM pattern_stops ps \
             JOIN stops s ON s.stop_pk = ps.stop_pk \
             WHERE ps.pattern_pk = ?1 AND s.stop_id = ?2 AND s.agency = ?3 LIMIT 1",
        )?;

        let mut trips = HashMap::new();
        let mut stats = FeedStats::default();
        for update in feed.entity.into_iter().filter_map(|e| e.trip_update) {
            stats.trip_updates += 1;
            let Some(trip) = update.trip else { continue };
            let Some(trip_id) = trip.trip_id else { continue };
            let cancelled = trip.schedule_relationship == Some(TRIP_CANCELED);

            let matches: Vec<(i64, i64, i64)> = trip_lookup
                .query_map([&trip_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
                .collect::<Result<_, _>>()?;

            if matches.is_empty() {
                stats.unmatched += 1;
                stats.sample_unmatched_trip_id.get_or_insert(trip_id.clone());
            }

            for (trip_pk, pattern_pk, agency) in matches {
                if cancelled {
                    trips.insert(trip_pk, TripRealtime::Cancelled);
                    continue;
                }
                let mut points = Vec::new();
                for stu in &update.stop_time_update {
                    let Some((arrival, departure)) = delays_of(stu) else { continue };
                    let stop_sequence = match (stu.stop_sequence, &stu.stop_id) {
                        (Some(seq), _) => i64::from(seq),
                        (None, Some(stop_id)) => {
                            let found = seq_lookup
                                .query_row(rusqlite::params![pattern_pk, stop_id, agency], |r| r.get::<_, i64>(0));
                            match found {
                                Ok(seq) => seq,
                                Err(rusqlite::Error::QueryReturnedNoRows) => continue,
                                Err(e) => return Err(e.into()),
                            }
                        }
                        (None, None) => continue,
                    };
                    points.push(DelayPoint { stop_sequence, arrival_delay_sec: arrival, departure_delay_sec: departure });
                }
                if points.is_empty() { continue; }
                points.sort_by_key(|p| p.stop_sequence);
                trips.insert(trip_pk, TripRealtime::Delays(points));
            }
        }
        stats.applied = trips.len();
        Ok((Self { trips }, stats))
    }
}

/// (arrival delay, departure delay). A missing side takes the other, per
/// the GTFS-rt spec; None if the update has no `delay` at all.
fn delays_of(stu: &StopTimeUpdate) -> Option<(i64, i64)> {
    let arrival = stu.arrival.as_ref().and_then(|e| e.delay).map(i64::from);
    let departure = stu.departure.as_ref().and_then(|e| e.delay).map(i64::from);
    match (arrival, departure) {
        (None, None) => None,
        (a, d) => Some((a.or(d)?, d.or(a)?)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::realtime::feed::*;

    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE trips (trip_pk INTEGER PRIMARY KEY, trip_id TEXT, agency INTEGER, pattern_pk INTEGER);
             CREATE TABLE stops (stop_pk INTEGER PRIMARY KEY, stop_id TEXT, agency INTEGER);
             CREATE TABLE pattern_stops (pattern_pk INTEGER, stop_pk INTEGER, stop_sequence INTEGER);
             INSERT INTO trips VALUES (1, 'T1', 1, 10), (2, 'T2', 1, 10);
             INSERT INTO stops VALUES (100, 'A', 1), (101, 'B', 1), (102, 'C', 1);
             INSERT INTO pattern_stops VALUES (10, 100, 1), (10, 101, 2), (10, 102, 3);",
        ).unwrap();
        conn
    }

    fn event(delay: i32) -> Option<StopTimeEvent> { Some(StopTimeEvent { delay: Some(delay) }) }

    fn encode(updates: Vec<TripUpdate>) -> Vec<u8> {
        FeedMessage { entity: updates.into_iter().map(|u| FeedEntity { trip_update: Some(u) }).collect() }.encode_to_vec()
    }

    #[test]
    fn delay_holds_until_next_update_and_resolves_stop_ids() {
        let bytes = encode(vec![TripUpdate {
            trip: Some(TripDescriptor { trip_id: Some("T1".into()), schedule_relationship: None }),
            stop_time_update: vec![
                StopTimeUpdate { stop_sequence: None, stop_id: Some("B".into()), arrival: event(60), departure: None },
            ],
        }]);
        let overlay = Overlay::from_feed(&bytes, &test_db()).unwrap().0;
        assert_eq!(overlay.apply(1, 1, 1000, 1010), (1000, 1010, 0)); // before first update
        assert_eq!(overlay.apply(1, 2, 1100, 1110), (1160, 1170, 60));
        assert_eq!(overlay.apply(1, 3, 1200, 1210), (1260, 1270, 60)); // carried forward
        assert_eq!(overlay.apply(2, 2, 1100, 1110), (1100, 1110, 0)); // other trip untouched
    }

    #[test]
    fn cancelled_trip_is_flagged() {
        let bytes = encode(vec![TripUpdate {
            trip: Some(TripDescriptor { trip_id: Some("T2".into()), schedule_relationship: Some(TRIP_CANCELED) }),
            stop_time_update: vec![],
        }]);
        let overlay = Overlay::from_feed(&bytes, &test_db()).unwrap().0;
        assert!(overlay.is_cancelled(2));
        assert!(!overlay.is_cancelled(1));
    }

    #[test]
    fn feeds_merge_into_one_overlay() {
        let delayed = encode(vec![TripUpdate {
            trip: Some(TripDescriptor { trip_id: Some("T1".into()), schedule_relationship: None }),
            stop_time_update: vec![StopTimeUpdate { stop_sequence: Some(1), stop_id: None, arrival: event(120), departure: None }],
        }]);
        let cancelled = encode(vec![TripUpdate {
            trip: Some(TripDescriptor { trip_id: Some("T2".into()), schedule_relationship: Some(TRIP_CANCELED) }),
            stop_time_update: vec![],
        }]);
        let (overlay, per_feed) = Overlay::from_feeds(&[delayed, cancelled], &test_db()).unwrap();
        assert_eq!(per_feed.iter().map(|s| s.applied).collect::<Vec<_>>(), vec![1, 1]);
        assert_eq!(overlay.apply(1, 1, 1000, 1010), (1120, 1130, 120));
        assert!(overlay.is_cancelled(2));
    }

    #[test]
    fn unknown_trip_and_time_only_updates_are_ignored() {
        let bytes = encode(vec![
            TripUpdate { trip: Some(TripDescriptor { trip_id: Some("nope".into()), schedule_relationship: None }),
                stop_time_update: vec![StopTimeUpdate { stop_sequence: Some(1), stop_id: None, arrival: event(30), departure: None }] },
            TripUpdate { trip: Some(TripDescriptor { trip_id: Some("T1".into()), schedule_relationship: None }),
                stop_time_update: vec![StopTimeUpdate { stop_sequence: Some(1), stop_id: None, arrival: Some(StopTimeEvent { delay: None }), departure: None }] },
        ]);
        let (overlay, stats) = Overlay::from_feed(&bytes, &test_db()).unwrap();
        assert_eq!(overlay.trip_count(), 0);
        assert_eq!((stats.trip_updates, stats.unmatched), (2, 1));
        assert_eq!(stats.sample_unmatched_trip_id.as_deref(), Some("nope"));
    }
}
