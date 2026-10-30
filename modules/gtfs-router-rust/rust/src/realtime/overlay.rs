//! Per-trip delays and cancellations, keyed by trip_pk so the loader can
//! apply them while it builds StopTimeEntry rows.

use std::collections::HashMap;
use prost::Message;
use rusqlite::Connection;
use super::added::{self, AddedStop, AddedTrip};
use super::feed::{FeedMessage, StopTimeUpdate, STOP_SKIPPED, TRIP_CANCELED};

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
    Updated {
        delays: Vec<DelayPoint>, // sorted by stop_sequence
        skipped: Vec<i64>,       // stop_sequences the vehicle will not serve
    },
}

/// What one feed contained, for diagnosing id mismatches with the timetable.
#[derive(Debug, Default, Clone)]
pub struct FeedStats {
    /// Trip updates in the feed.
    pub trip_updates: usize,
    /// Updates whose trip_id is not in the timetable DB.
    pub unmatched: usize,
    /// Of those, how many are marked added, unscheduled or replacement trips rather than scheduled ones.
    pub unmatched_not_scheduled: usize,
    /// Of those, how many had stop times the router can ride.
    pub added_usable: usize,
    /// Trips that ended up with usable delay or cancellation data.
    pub applied: usize,
    pub sample_unmatched_trip_id: Option<String>,
}

#[derive(Default)]
pub struct Overlay {
    trips: HashMap<i64, TripRealtime>,
    added: Vec<AddedTrip>,
}

impl Overlay {
    pub fn added_trips(&self) -> &[AddedTrip] {
        &self.added
    }

    /// The added trips that call at this stop and go on to another one, each with its call there. A trip's
    /// last stop is left out, since nobody can board there.
    pub fn added_leaving(&self, stop_pk: i64) -> Vec<(&AddedTrip, AddedStop)> {
        self.added
            .iter()
            .filter_map(|trip| {
                let (_, before_last) = trip.stops.split_last()?;
                before_last.iter().find(|s| s.stop_pk == stop_pk).map(|call| (trip, *call))
            })
            .collect()
    }

    #[cfg(test)]
    pub fn trip_count(&self) -> usize {
        self.trips.len()
    }

    pub fn is_cancelled(&self, trip_pk: i64) -> bool {
        matches!(self.trips.get(&trip_pk), Some(TripRealtime::Cancelled))
    }

    /// True if the vehicle will not stop at this stop of the trip.
    pub fn is_skipped(&self, trip_pk: i64, stop_sequence: i64) -> bool {
        matches!(self.trips.get(&trip_pk), Some(TripRealtime::Updated { skipped, .. }) if skipped.contains(&stop_sequence))
    }

    /// The delay point in force at this stop: the last update at or before it.
    fn delay_point(&self, trip_pk: i64, stop_sequence: i64) -> Option<DelayPoint> {
        let Some(TripRealtime::Updated { delays: points, .. }) = self.trips.get(&trip_pk) else {
            return None;
        };
        let idx = points.partition_point(|p| p.stop_sequence <= stop_sequence);
        idx.checked_sub(1).map(|i| points[i])
    }

    /// Seconds the vehicle is late leaving this stop of the trip (negative when early), or None when the
    /// feed has no update covering it: no update for the trip, or the stop is before its first one.
    pub fn departure_delay(&self, trip_pk: i64, stop_sequence: i64) -> Option<i64> {
        self.delay_point(trip_pk, stop_sequence).map(|p| p.departure_delay_sec)
    }

    /// Like `departure_delay`, for arriving at the stop. Feeds can report the two differently.
    pub fn arrival_delay(&self, trip_pk: i64, stop_sequence: i64) -> Option<i64> {
        self.delay_point(trip_pk, stop_sequence).map(|p| p.arrival_delay_sec)
    }

    /// Returns (arrival_sec, departure_sec, departure_delay_sec) with the
    /// trip's delay at this stop applied. Stops before a trip's first
    /// update keep their scheduled times.
    pub fn apply(&self, trip_pk: i64, stop_sequence: i64, arrival_sec: i64, departure_sec: i64) -> (i64, i64, i64) {
        let Some(TripRealtime::Updated { delays: points, .. }) = self.trips.get(&trip_pk) else {
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
    pub fn from_feeds(feeds: &[Vec<u8>], service_midnight_epoch: i64, conn: &Connection) -> Result<(Self, Vec<FeedStats>), OverlayError> {
        let mut merged = Self::default();
        let mut per_feed = Vec::with_capacity(feeds.len());
        for bytes in feeds {
            let (overlay, stats) = Self::from_feed(bytes, service_midnight_epoch, conn)?;
            per_feed.push(stats);
            merged.trips.extend(overlay.trips);
            merged.added.extend(overlay.added);
        }
        Ok((merged, per_feed))
    }

    /// Decodes a TripUpdates feed and resolves its text ids against the
    /// timetable DB. Updates that only carry absolute times (no `delay`)
    /// are ignored.
    pub fn from_feed(bytes: &[u8], service_midnight_epoch: i64, conn: &Connection) -> Result<(Self, FeedStats), OverlayError> {
        let feed = FeedMessage::decode(bytes)?;
        let mut trip_lookup = conn.prepare("SELECT trip_pk, pattern_pk, agency FROM trips WHERE trip_id = ?1")?;
        let mut seq_lookup = conn.prepare(
            "SELECT ps.stop_sequence FROM pattern_stops ps \
             JOIN stops s ON s.stop_pk = ps.stop_pk \
             WHERE ps.pattern_pk = ?1 AND s.stop_id = ?2 AND s.agency = ?3 LIMIT 1",
        )?;

        let mut trips = HashMap::new();
        let mut added_trips = Vec::new();
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
                if trip.schedule_relationship.unwrap_or(0) != 0 {
                    stats.unmatched_not_scheduled += 1;
                    if let Some(trip) = added::build(trip.route_id.as_deref(), &update.stop_time_update, service_midnight_epoch, conn)? {
                        added_trips.push(trip);
                        stats.added_usable += 1;
                    }
                }
                stats.sample_unmatched_trip_id.get_or_insert(trip_id.clone());
            }

            for (trip_pk, pattern_pk, agency) in matches {
                if cancelled {
                    trips.insert(trip_pk, TripRealtime::Cancelled);
                    continue;
                }
                let mut points = Vec::new();
                let mut skipped = Vec::new();
                for stu in &update.stop_time_update {
                    let is_skipped = stu.schedule_relationship == Some(STOP_SKIPPED);
                    let delays = delays_of(stu);
                    if !is_skipped && delays.is_none() { continue; }
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
                    if is_skipped {
                        skipped.push(stop_sequence);
                    } else if let Some((arrival, departure)) = delays {
                        points.push(DelayPoint { stop_sequence, arrival_delay_sec: arrival, departure_delay_sec: departure });
                    }
                }
                if points.is_empty() && skipped.is_empty() { continue; }
                points.sort_by_key(|p| p.stop_sequence);
                trips.insert(trip_pk, TripRealtime::Updated { delays: points, skipped });
            }
        }
        stats.applied = trips.len();
        Ok((Self { trips, added: added_trips }, stats))
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
             CREATE TABLE routes (route_id TEXT, agency INTEGER);
             INSERT INTO routes VALUES ('R1', 1);
             CREATE TABLE pattern_stops (pattern_pk INTEGER, stop_pk INTEGER, stop_sequence INTEGER);
             INSERT INTO trips VALUES (1, 'T1', 1, 10), (2, 'T2', 1, 10);
             INSERT INTO stops VALUES (100, 'A', 1), (101, 'B', 1), (102, 'C', 1);
             INSERT INTO pattern_stops VALUES (10, 100, 1), (10, 101, 2), (10, 102, 3);",
        ).unwrap();
        conn
    }

    fn event(delay: i32) -> Option<StopTimeEvent> { Some(StopTimeEvent { delay: Some(delay), time: None }) }

    fn encode(updates: Vec<TripUpdate>) -> Vec<u8> {
        FeedMessage { entity: updates.into_iter().map(|u| FeedEntity { trip_update: Some(u), vehicle: None }).collect() }.encode_to_vec()
    }

    #[test]
    fn delay_holds_until_next_update_and_resolves_stop_ids() {
        let bytes = encode(vec![TripUpdate {
            trip: Some(TripDescriptor { trip_id: Some("T1".into()), route_id: None, schedule_relationship: None }),
            stop_time_update: vec![
                StopTimeUpdate { stop_sequence: None, stop_id: Some("B".into()), arrival: event(60), departure: None, schedule_relationship: None },
            ],
        }]);
        let overlay = Overlay::from_feed(&bytes, 0, &test_db()).unwrap().0;
        assert_eq!(overlay.apply(1, 1, 1000, 1010), (1000, 1010, 0)); // before first update
        assert_eq!(overlay.apply(1, 2, 1100, 1110), (1160, 1170, 60));
        assert_eq!(overlay.apply(1, 3, 1200, 1210), (1260, 1270, 60)); // carried forward
        assert_eq!(overlay.apply(2, 2, 1100, 1110), (1100, 1110, 0)); // other trip untouched
    }

    #[test]
    fn departure_delay_is_none_until_the_feed_covers_the_stop() {
        let bytes = encode(vec![TripUpdate {
            trip: Some(TripDescriptor { trip_id: Some("T1".into()), route_id: None, schedule_relationship: None }),
            stop_time_update: vec![
                StopTimeUpdate { stop_sequence: Some(2), stop_id: None, arrival: event(-30), departure: event(90), schedule_relationship: None },
            ],
        }]);
        let overlay = Overlay::from_feed(&bytes, 0, &test_db()).unwrap().0;
        assert_eq!(overlay.departure_delay(1, 1), None); // before the first update
        assert_eq!(overlay.departure_delay(1, 2), Some(90));
        assert_eq!(overlay.departure_delay(1, 3), Some(90)); // carried forward
        assert_eq!(overlay.departure_delay(2, 2), None); // trip with no update
        assert_eq!(overlay.departure_delay(99, 2), None); // unknown trip
    }

    #[test]
    fn arrival_delay_can_differ_from_departure_delay() {
        let bytes = encode(vec![TripUpdate {
            trip: Some(TripDescriptor { trip_id: Some("T1".into()), route_id: None, schedule_relationship: None }),
            stop_time_update: vec![
                StopTimeUpdate { stop_sequence: Some(2), stop_id: None, arrival: event(-30), departure: event(90), schedule_relationship: None },
            ],
        }]);
        let overlay = Overlay::from_feed(&bytes, 0, &test_db()).unwrap().0;
        assert_eq!(overlay.arrival_delay(1, 1), None); // before the first update
        assert_eq!(overlay.arrival_delay(1, 2), Some(-30));
        assert_eq!(overlay.departure_delay(1, 2), Some(90));
        assert_eq!(overlay.arrival_delay(1, 3), Some(-30)); // carried forward
        assert_eq!(overlay.arrival_delay(99, 2), None); // unknown trip
    }

    #[test]
    fn departure_delay_is_none_for_cancelled_trips_and_zero_when_on_time() {
        let bytes = encode(vec![
            TripUpdate {
                trip: Some(TripDescriptor { trip_id: Some("T1".into()), route_id: None, schedule_relationship: None }),
                stop_time_update: vec![StopTimeUpdate { stop_sequence: Some(1), stop_id: None, arrival: event(0), departure: None, schedule_relationship: None }],
            },
            TripUpdate {
                trip: Some(TripDescriptor { trip_id: Some("T2".into()), route_id: None, schedule_relationship: Some(TRIP_CANCELED) }),
                stop_time_update: vec![],
            },
        ]);
        let overlay = Overlay::from_feed(&bytes, 0, &test_db()).unwrap().0;
        assert_eq!(overlay.departure_delay(1, 1), Some(0));
        assert_eq!(overlay.departure_delay(2, 1), None);
        assert!(overlay.is_cancelled(2));
    }

    #[test]
    fn skipped_stop_is_flagged_and_does_not_break_delays() {
        let bytes = encode(vec![TripUpdate {
            trip: Some(TripDescriptor { trip_id: Some("T1".into()), route_id: None, schedule_relationship: None }),
            stop_time_update: vec![
                StopTimeUpdate { stop_sequence: Some(1), stop_id: None, arrival: event(60), departure: None, schedule_relationship: None },
                StopTimeUpdate { stop_sequence: None, stop_id: Some("B".into()), arrival: None, departure: None, schedule_relationship: Some(STOP_SKIPPED) },
            ],
        }]);
        let (overlay, stats) = Overlay::from_feed(&bytes, 0, &test_db()).unwrap();
        assert!(overlay.is_skipped(1, 2));
        assert!(!overlay.is_skipped(1, 3));
        assert_eq!(overlay.apply(1, 3, 1200, 1210), (1260, 1270, 60));
        assert_eq!(stats.applied, 1);
    }

    fn timed(epoch: i64) -> Option<StopTimeEvent> { Some(StopTimeEvent { delay: None, time: Some(epoch) }) }

    #[test]
    fn added_trip_becomes_stop_times_in_seconds_since_midnight() {
        let at = |stop: &str, t: i64| StopTimeUpdate {
            stop_sequence: None, stop_id: Some(stop.into()), arrival: timed(t), departure: timed(t), schedule_relationship: None,
        };
        let bytes = encode(vec![TripUpdate {
            trip: Some(TripDescriptor { trip_id: Some("extra".into()), route_id: Some("R1".into()), schedule_relationship: Some(1) }),
            // C is before B in time, so it is dropped as out of order; 'Z' is unknown.
            stop_time_update: vec![at("A", 51_000), at("Z", 51_100), at("B", 51_600), at("C", 51_300)],
        }]);
        let (overlay, stats) = Overlay::from_feed(&bytes, 50_000, &test_db()).unwrap();
        assert_eq!(stats.added_usable, 1);
        let trip = &overlay.added_trips()[0];
        assert_eq!(trip.agency, 1);
        assert_eq!(trip.stops.iter().map(|s| (s.stop_pk, s.departure_sec)).collect::<Vec<_>>(), vec![(100, 1000), (101, 1600)]);
    }

    #[test]
    fn added_trips_are_listed_at_every_stop_but_their_last() {
        let at = |stop: &str, t: i64| StopTimeUpdate {
            stop_sequence: None, stop_id: Some(stop.into()), arrival: timed(t), departure: timed(t), schedule_relationship: None,
        };
        let bytes = encode(vec![TripUpdate {
            trip: Some(TripDescriptor { trip_id: Some("extra".into()), route_id: Some("R1".into()), schedule_relationship: Some(1) }),
            stop_time_update: vec![at("A", 51_000), at("B", 51_600)],
        }]);
        let overlay = Overlay::from_feed(&bytes, 50_000, &test_db()).unwrap().0;
        let from_a = overlay.added_leaving(100);
        assert_eq!(from_a.len(), 1);
        assert_eq!((from_a[0].1.departure_sec, from_a[0].0.route_id.as_deref()), (1000, Some("R1")));
        assert!(overlay.added_leaving(101).is_empty()); // the last stop
        assert!(overlay.added_leaving(999).is_empty()); // not on the trip
    }

    #[test]
    fn unmatched_added_trip_is_counted_separately() {
        let bytes = encode(vec![TripUpdate {
            trip: Some(TripDescriptor { trip_id: Some("extra".into()), route_id: None, schedule_relationship: Some(1) }),
            stop_time_update: vec![],
        }]);
        let (_, stats) = Overlay::from_feed(&bytes, 0, &test_db()).unwrap();
        assert_eq!((stats.unmatched, stats.unmatched_not_scheduled), (1, 1));
    }

    #[test]
    fn cancelled_trip_is_flagged() {
        let bytes = encode(vec![TripUpdate {
            trip: Some(TripDescriptor { trip_id: Some("T2".into()), route_id: None, schedule_relationship: Some(TRIP_CANCELED) }),
            stop_time_update: vec![],
        }]);
        let overlay = Overlay::from_feed(&bytes, 0, &test_db()).unwrap().0;
        assert!(overlay.is_cancelled(2));
        assert!(!overlay.is_cancelled(1));
    }

    #[test]
    fn feeds_merge_into_one_overlay() {
        let delayed = encode(vec![TripUpdate {
            trip: Some(TripDescriptor { trip_id: Some("T1".into()), route_id: None, schedule_relationship: None }),
            stop_time_update: vec![StopTimeUpdate { stop_sequence: Some(1), stop_id: None, arrival: event(120), departure: None, schedule_relationship: None }],
        }]);
        let cancelled = encode(vec![TripUpdate {
            trip: Some(TripDescriptor { trip_id: Some("T2".into()), route_id: None, schedule_relationship: Some(TRIP_CANCELED) }),
            stop_time_update: vec![],
        }]);
        let (overlay, per_feed) = Overlay::from_feeds(&[delayed, cancelled], 0, &test_db()).unwrap();
        assert_eq!(per_feed.iter().map(|s| s.applied).collect::<Vec<_>>(), vec![1, 1]);
        assert_eq!(overlay.apply(1, 1, 1000, 1010), (1120, 1130, 120));
        assert!(overlay.is_cancelled(2));
    }

    #[test]
    fn unknown_trip_and_time_only_updates_are_ignored() {
        let bytes = encode(vec![
            TripUpdate { trip: Some(TripDescriptor { trip_id: Some("nope".into()), route_id: None, schedule_relationship: None }),
                stop_time_update: vec![StopTimeUpdate { stop_sequence: Some(1), stop_id: None, arrival: event(30), departure: None, schedule_relationship: None }] },
            TripUpdate { trip: Some(TripDescriptor { trip_id: Some("T1".into()), route_id: None, schedule_relationship: None }),
                stop_time_update: vec![StopTimeUpdate { stop_sequence: Some(1), stop_id: None, arrival: Some(StopTimeEvent { delay: None, time: None }), departure: None, schedule_relationship: None }] },
        ]);
        let (overlay, stats) = Overlay::from_feed(&bytes, 0, &test_db()).unwrap();
        assert_eq!(overlay.trip_count(), 0);
        assert_eq!((stats.trip_updates, stats.unmatched), (2, 1));
        assert_eq!(stats.sample_unmatched_trip_id.as_deref(), Some("nope"));
    }
}
