//! Adds the overlay's added trips to a loaded index so the search can use
//! them like any scheduled trip.

use std::rc::Rc;
use crate::loader::{GtfsIndex, PatternMetaFull, StopTimeEntry};
use crate::repo::RoutesCache;
use super::overlay::Overlay;

/// Real pks are small, so injected ones starting here can't collide with them.
const INJECTED_PK_BASE: i64 = 1 << 40;

fn insert_sorted(list: &mut Vec<Rc<StopTimeEntry>>, entry: Rc<StopTimeEntry>) {
    let at = list.partition_point(|e| e.departure_sec <= entry.departure_sec);
    list.insert(at, entry);
}

/// Each added trip becomes its own one-trip pattern. Stops outside the
/// loaded corridor are dropped; a trip left with fewer than two is skipped.
pub fn inject_added_trips(index: &mut GtfsIndex, overlay: &Overlay, routes: &RoutesCache) {
    for (n, trip) in overlay.added_trips().iter().enumerate() {
        let stops: Vec<_> = trip.stops.iter().filter(|s| index.allowed_stop_pks.contains(&s.stop_pk)).collect();
        if stops.len() < 2 { continue; }

        let pk = INJECTED_PK_BASE + n as i64;
        let route_info = trip.route_id.as_ref()
            .and_then(|rid| routes.id_by_key.get(&(trip.agency, rid.clone())))
            .and_then(|&id| routes.info_by_id.get(id as usize));
        let (route_name, route_type, route_color, route_text_color) = match route_info {
            Some(ri) => (
                if !ri.route_short_name.is_empty() { ri.route_short_name.clone() } else if !ri.route_long_name.is_empty() { ri.route_long_name.clone() } else { "?".to_string() },
                ri.route_type, ri.route_color.clone(), if ri.route_text_color.is_empty() { "#FFFFFF".to_string() } else { ri.route_text_color.clone() },
            ),
            None => ("?".to_string(), 3, String::new(), "#FFFFFF".to_string()),
        };
        index.patterns_by_pk.insert(pk, PatternMetaFull {
            agency: trip.agency, route_id: trip.route_id.clone().unwrap_or_default(), shape_id: None,
            route_name, route_type, route_color, route_text_color,
        });
        index.pattern_stops.insert(pk, stops.iter().enumerate().map(|(i, s)| (s.stop_pk, i as i64 + 1)).collect());

        for (i, s) in stops.iter().enumerate() {
            let entry = Rc::new(StopTimeEntry {
                trip_pk: pk, pattern_pk: pk, stop_sequence: i as i64 + 1,
                arrival_sec: s.arrival_sec, departure_sec: s.departure_sec,
                pickup_type: 0, drop_off_type: 0, departure_delay_sec: 0,
            });
            insert_sorted(index.stop_times_by_stop.entry(s.stop_pk).or_default(), Rc::clone(&entry));
            insert_sorted(index.stop_times_by_stop_and_pattern.entry((s.stop_pk, pk)).or_default(), Rc::clone(&entry));
            index.stop_times_by_stop_and_trip.entry(s.stop_pk).or_default().insert(pk, entry);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(departure_sec: i64) -> Rc<StopTimeEntry> {
        Rc::new(StopTimeEntry {
            trip_pk: 0, pattern_pk: 0, stop_sequence: 1, arrival_sec: departure_sec, departure_sec,
            pickup_type: 0, drop_off_type: 0, departure_delay_sec: 0,
        })
    }

    #[test]
    fn insert_keeps_departure_order() {
        let mut list = vec![entry(100), entry(300)];
        insert_sorted(&mut list, entry(200));
        insert_sorted(&mut list, entry(50));
        assert_eq!(list.iter().map(|e| e.departure_sec).collect::<Vec<_>>(), vec![50, 100, 200, 300]);
    }
}
