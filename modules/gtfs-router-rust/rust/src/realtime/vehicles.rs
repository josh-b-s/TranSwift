//! GTFS-realtime VehiclePositions: where each vehicle is, for drawing on a map. Needs no timetable, so the
//! caller matches a vehicle to its route afterwards.

use prost::Message;
use super::feed::FeedMessage;

/// One vehicle with a usable position.
#[derive(Debug, Clone, PartialEq)]
pub struct Vehicle {
    /// The feed's vehicle id, else its label, else the trip id: whatever tells two vehicles apart.
    pub key: String,
    pub label: Option<String>,
    pub trip_id: Option<String>,
    pub route_id: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub bearing: Option<f32>,
    pub speed_mps: Option<f32>,
    /// Seconds since the epoch, clamped to what a u32 holds (until 2106).
    pub timestamp_sec: Option<u32>,
    /// The stop sequence the vehicle is at or heading to, as the feed numbers it.
    pub current_stop_sequence: Option<u32>,
}

fn non_empty(value: Option<String>) -> Option<String> {
    value.filter(|v| !v.is_empty())
}

/// Vehicles in one feed. Entities with no position, a position outside the globe, or the 0,0 that some feeds send
/// for "unknown" are dropped.
pub fn decode(bytes: &[u8]) -> Result<Vec<Vehicle>, prost::DecodeError> {
    let feed = FeedMessage::decode(bytes)?;
    Ok(feed.entity.into_iter().filter_map(|e| e.vehicle).filter_map(|v| {
        let position = v.position?;
        let (latitude, longitude) = (f64::from(position.latitude?), f64::from(position.longitude?));
        let valid = latitude.is_finite() && longitude.is_finite()
            && (-90.0..=90.0).contains(&latitude) && (-180.0..=180.0).contains(&longitude)
            && !(latitude == 0.0 && longitude == 0.0);
        if !valid { return None; }

        let (trip_id, route_id) = v.trip.map(|t| (non_empty(t.trip_id), non_empty(t.route_id))).unwrap_or((None, None));
        let (id, label) = v.vehicle.map(|d| (non_empty(d.id), non_empty(d.label))).unwrap_or((None, None));
        let key = id.or_else(|| label.clone()).or_else(|| trip_id.clone())?;
        Some(Vehicle {
            key,
            label,
            trip_id,
            route_id,
            latitude,
            longitude,
            bearing: position.bearing.filter(|b| b.is_finite()),
            speed_mps: position.speed.filter(|s| s.is_finite() && *s >= 0.0),
            timestamp_sec: v.timestamp.map(|t| t.min(u64::from(u32::MAX)) as u32),
            current_stop_sequence: v.current_stop_sequence,
        })
    }).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::realtime::feed::*;

    fn entity(vehicle: VehiclePosition) -> FeedEntity {
        FeedEntity { trip_update: None, vehicle: Some(vehicle) }
    }

    fn at(lat: f32, lon: f32) -> Option<Position> {
        Some(Position { latitude: Some(lat), longitude: Some(lon), bearing: None, speed: None })
    }

    fn feed(entities: Vec<FeedEntity>) -> Vec<u8> {
        FeedMessage { entity: entities }.encode_to_vec()
    }

    fn descriptor(id: Option<&str>, label: Option<&str>) -> Option<VehicleDescriptor> {
        Some(VehicleDescriptor { id: id.map(Into::into), label: label.map(Into::into) })
    }

    #[test]
    fn reads_position_route_and_motion() {
        let bytes = feed(vec![entity(VehiclePosition {
            trip: Some(TripDescriptor { trip_id: Some("T1".into()), route_id: Some("R1".into()), schedule_relationship: None }),
            position: Some(Position { latitude: Some(-37.8136), longitude: Some(144.9631), bearing: Some(90.0), speed: Some(8.5) }),
            current_stop_sequence: Some(4),
            timestamp: Some(1_790_000_000),
            vehicle: descriptor(Some("V9"), Some("Tram 9")),
        })]);
        let out = decode(&bytes).unwrap();
        assert_eq!(out.len(), 1);
        let v = &out[0];
        assert_eq!((v.key.as_str(), v.label.as_deref(), v.trip_id.as_deref(), v.route_id.as_deref()), ("V9", Some("Tram 9"), Some("T1"), Some("R1")));
        assert!((v.latitude + 37.8136).abs() < 1e-4 && (v.longitude - 144.9631).abs() < 1e-4);
        assert_eq!((v.bearing, v.speed_mps, v.timestamp_sec), (Some(90.0), Some(8.5), Some(1_790_000_000)));
        assert_eq!(v.current_stop_sequence, Some(4));
    }

    #[test]
    fn drops_vehicles_without_a_usable_position_or_identity() {
        let ok = VehiclePosition { trip: None, position: at(-37.0, 144.0), current_stop_sequence: None, timestamp: None, vehicle: descriptor(Some("A"), None) };
        let bytes = feed(vec![
            entity(VehiclePosition { position: None, ..ok.clone() }),
            entity(VehiclePosition { position: at(0.0, 0.0), ..ok.clone() }),
            entity(VehiclePosition { position: at(95.0, 10.0), ..ok.clone() }),
            entity(VehiclePosition { position: at(10.0, 200.0), ..ok.clone() }),
            entity(VehiclePosition { position: Some(Position { latitude: Some(-37.0), longitude: None, bearing: None, speed: None }), ..ok.clone() }),
            entity(VehiclePosition { vehicle: None, trip: None, ..ok.clone() }), // nothing to tell it apart by
            entity(ok.clone()),
            FeedEntity { trip_update: Some(TripUpdate { trip: None, stop_time_update: vec![] }), vehicle: None },
        ]);
        let out = decode(&bytes).unwrap();
        assert_eq!(out.iter().map(|v| v.key.as_str()).collect::<Vec<_>>(), vec!["A"]);
    }

    #[test]
    fn identity_falls_back_from_id_to_label_to_trip() {
        let base = VehiclePosition { trip: None, position: at(-37.0, 144.0), current_stop_sequence: None, timestamp: None, vehicle: None };
        let bytes = feed(vec![
            entity(VehiclePosition { vehicle: descriptor(Some(""), Some("Label")), ..base.clone() }),
            entity(VehiclePosition { trip: Some(TripDescriptor { trip_id: Some("T7".into()), route_id: Some("".into()), schedule_relationship: None }), ..base.clone() }),
        ]);
        let out = decode(&bytes).unwrap();
        assert_eq!(out.iter().map(|v| v.key.as_str()).collect::<Vec<_>>(), vec!["Label", "T7"]);
        assert_eq!(out[1].route_id, None); // a blank id is no id
    }

    #[test]
    fn rejects_bytes_that_are_not_a_feed_and_clamps_odd_numbers() {
        assert!(decode(&[0xFF, 0xFF, 0xFF]).is_err());
        let bytes = feed(vec![entity(VehiclePosition {
            trip: None,
            position: Some(Position { latitude: Some(-37.0), longitude: Some(144.0), bearing: Some(f32::NAN), speed: Some(-1.0) }),
            current_stop_sequence: None,
            timestamp: Some(u64::MAX),
            vehicle: descriptor(Some("A"), None),
        })]);
        let v = &decode(&bytes).unwrap()[0];
        assert_eq!((v.bearing, v.speed_mps, v.timestamp_sec), (None, None, Some(u32::MAX)));
    }
}
