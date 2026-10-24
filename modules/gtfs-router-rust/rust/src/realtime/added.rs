//! Trips that exist only in the realtime feed (added or replacement trips),
//! turned into stop times the router can ride.

use rusqlite::Connection;
use super::feed::{StopTimeEvent, StopTimeUpdate, STOP_SKIPPED};

#[derive(Debug, Clone, Copy)]
pub struct AddedStop {
    pub stop_pk: i64,
    pub arrival_sec: i64,
    pub departure_sec: i64,
}

#[derive(Debug, Clone)]
pub struct AddedTrip {
    pub route_id: Option<String>,
    /// Agency of the trip's first stop; with route_id it picks the route's name and colour.
    pub agency: i64,
    /// In travel order, times in seconds since the service day's midnight.
    pub stops: Vec<AddedStop>,
}

/// Seconds since midnight for one stop, from the absolute `time` values. A
/// missing side takes the other; None if the update has no `time` at all.
fn times_of(stu: &StopTimeUpdate, service_midnight_epoch: i64) -> Option<(i64, i64)> {
    let secs = |e: &Option<StopTimeEvent>| e.as_ref().and_then(|e| e.time).map(|t| t - service_midnight_epoch);
    let (arrival, departure) = (secs(&stu.arrival), secs(&stu.departure));
    Some((arrival.or(departure)?, departure.or(arrival)?))
}

/// None when fewer than two stops could be placed in the timetable with
/// increasing times.
pub fn build(
    route_id: Option<&str>,
    updates: &[StopTimeUpdate],
    service_midnight_epoch: i64,
    conn: &Connection,
) -> rusqlite::Result<Option<AddedTrip>> {
    let route_agencies: Vec<i64> = match route_id {
        Some(rid) => conn.prepare("SELECT agency FROM routes WHERE route_id = ?1")?
            .query_map([rid], |r| r.get(0))?
            .collect::<Result<_, _>>()?,
        None => Vec::new(),
    };
    let mut stop_lookup = conn.prepare("SELECT stop_pk, agency FROM stops WHERE stop_id = ?1")?;

    let mut agency = None;
    let mut stops: Vec<AddedStop> = Vec::new();
    for stu in updates {
        if stu.schedule_relationship == Some(STOP_SKIPPED) { continue; }
        let Some(stop_id) = &stu.stop_id else { continue };
        let Some((arrival_sec, departure_sec)) = times_of(stu, service_midnight_epoch) else { continue };

        let candidates: Vec<(i64, i64)> = stop_lookup
            .query_map([stop_id], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<Result<_, _>>()?;
        // Without a known route, only an unambiguous stop id can be trusted.
        let found = if route_agencies.is_empty() {
            if candidates.len() == 1 { Some(candidates[0]) } else { None }
        } else {
            candidates.iter().copied().find(|(_, a)| route_agencies.contains(a))
        };
        let Some((stop_pk, stop_agency)) = found else { continue };

        if stops.last().is_some_and(|prev| arrival_sec < prev.departure_sec) { continue; }
        agency.get_or_insert(stop_agency);
        stops.push(AddedStop { stop_pk, arrival_sec, departure_sec });
    }

    Ok(match (agency, stops.len() >= 2) {
        (Some(agency), true) => Some(AddedTrip { route_id: route_id.map(str::to_string), agency, stops }),
        _ => None,
    })
}
