//! The slice of gtfs-realtime.proto that TripUpdates need. Field numbers
//! match the official proto; everything we don't read is skipped on decode.

use prost::Message;

/// TripDescriptor.ScheduleRelationship::CANCELED
pub const TRIP_CANCELED: i32 = 3;
/// StopTimeUpdate.ScheduleRelationship::SKIPPED
pub const STOP_SKIPPED: i32 = 1;

#[derive(Clone, PartialEq, Message)]
pub struct FeedMessage {
    #[prost(message, repeated, tag = "2")]
    pub entity: Vec<FeedEntity>,
}

#[derive(Clone, PartialEq, Message)]
pub struct FeedEntity {
    #[prost(message, optional, tag = "3")]
    pub trip_update: Option<TripUpdate>,
    #[prost(message, optional, tag = "4")]
    pub vehicle: Option<VehiclePosition>,
}

#[derive(Clone, PartialEq, Message)]
pub struct TripUpdate {
    #[prost(message, optional, tag = "1")]
    pub trip: Option<TripDescriptor>,
    #[prost(message, repeated, tag = "2")]
    pub stop_time_update: Vec<StopTimeUpdate>,
}

#[derive(Clone, PartialEq, Message)]
pub struct TripDescriptor {
    #[prost(string, optional, tag = "1")]
    pub trip_id: Option<String>,
    #[prost(string, optional, tag = "5")]
    pub route_id: Option<String>,
    #[prost(int32, optional, tag = "4")]
    pub schedule_relationship: Option<i32>,
}

#[derive(Clone, PartialEq, Message)]
pub struct StopTimeUpdate {
    #[prost(uint32, optional, tag = "1")]
    pub stop_sequence: Option<u32>,
    #[prost(message, optional, tag = "2")]
    pub arrival: Option<StopTimeEvent>,
    #[prost(message, optional, tag = "3")]
    pub departure: Option<StopTimeEvent>,
    #[prost(string, optional, tag = "4")]
    pub stop_id: Option<String>,
    #[prost(int32, optional, tag = "5")]
    pub schedule_relationship: Option<i32>,
}

#[derive(Clone, PartialEq, Message)]
pub struct StopTimeEvent {
    #[prost(int32, optional, tag = "1")]
    pub delay: Option<i32>,
    /// Absolute POSIX time in seconds.
    #[prost(int64, optional, tag = "2")]
    pub time: Option<i64>,
}

#[derive(Clone, PartialEq, Message)]
pub struct VehiclePosition {
    #[prost(message, optional, tag = "1")]
    pub trip: Option<TripDescriptor>,
    #[prost(message, optional, tag = "2")]
    pub position: Option<Position>,
    #[prost(uint32, optional, tag = "3")]
    pub current_stop_sequence: Option<u32>,
    /// Seconds since the epoch when the position was measured.
    #[prost(uint64, optional, tag = "5")]
    pub timestamp: Option<u64>,
    #[prost(message, optional, tag = "8")]
    pub vehicle: Option<VehicleDescriptor>,
}

#[derive(Clone, PartialEq, Message)]
pub struct Position {
    #[prost(float, optional, tag = "1")]
    pub latitude: Option<f32>,
    #[prost(float, optional, tag = "2")]
    pub longitude: Option<f32>,
    /// Degrees clockwise from north.
    #[prost(float, optional, tag = "3")]
    pub bearing: Option<f32>,
    /// Metres per second.
    #[prost(float, optional, tag = "5")]
    pub speed: Option<f32>,
}

#[derive(Clone, PartialEq, Message)]
pub struct VehicleDescriptor {
    #[prost(string, optional, tag = "1")]
    pub id: Option<String>,
    #[prost(string, optional, tag = "2")]
    pub label: Option<String>,
}
