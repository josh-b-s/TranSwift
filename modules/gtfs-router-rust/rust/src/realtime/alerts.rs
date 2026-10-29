//! GTFS-realtime ServiceAlerts: notices about stops and routes. Needs no timetable; the caller matches the
//! feed's stop and route ids to its own afterwards. Uses its own slice of the proto so the TripUpdates and
//! VehiclePositions types stay untouched.

use prost::Message;

#[derive(Clone, PartialEq, Message)]
struct AlertFeed {
    #[prost(message, repeated, tag = "2")]
    entity: Vec<AlertEntity>,
}

#[derive(Clone, PartialEq, Message)]
struct AlertEntity {
    #[prost(string, tag = "1")]
    id: String,
    #[prost(bool, optional, tag = "2")]
    is_deleted: Option<bool>,
    #[prost(message, optional, tag = "5")]
    alert: Option<Alert>,
}

#[derive(Clone, PartialEq, Message)]
struct Alert {
    #[prost(message, repeated, tag = "1")]
    active_period: Vec<TimeRange>,
    #[prost(message, repeated, tag = "5")]
    informed_entity: Vec<EntitySelector>,
    #[prost(message, optional, tag = "8")]
    url: Option<TranslatedString>,
    #[prost(message, optional, tag = "10")]
    header_text: Option<TranslatedString>,
    #[prost(message, optional, tag = "11")]
    description_text: Option<TranslatedString>,
}

#[derive(Clone, PartialEq, Message)]
struct TimeRange {
    #[prost(uint64, optional, tag = "1")]
    start: Option<u64>,
    #[prost(uint64, optional, tag = "2")]
    end: Option<u64>,
}

#[derive(Clone, PartialEq, Message)]
struct EntitySelector {
    #[prost(string, optional, tag = "1")]
    agency_id: Option<String>,
    #[prost(string, optional, tag = "2")]
    route_id: Option<String>,
    #[prost(int32, optional, tag = "3")]
    route_type: Option<i32>,
    #[prost(message, optional, tag = "4")]
    trip: Option<TripSelector>,
    #[prost(string, optional, tag = "5")]
    stop_id: Option<String>,
}

#[derive(Clone, PartialEq, Message)]
struct TripSelector {
    #[prost(string, optional, tag = "1")]
    trip_id: Option<String>,
}

#[derive(Clone, PartialEq, Message)]
struct TranslatedString {
    #[prost(message, repeated, tag = "1")]
    translation: Vec<Translation>,
}

#[derive(Clone, PartialEq, Message)]
struct Translation {
    #[prost(string, tag = "1")]
    text: String,
    #[prost(string, optional, tag = "2")]
    language: Option<String>,
}

/// When an alert applies. A missing end means it has not been closed.
#[derive(Debug, Clone, PartialEq)]
pub struct Period {
    /// Seconds since the epoch, clamped to what a u32 holds (until 2106).
    pub start_sec: Option<u32>,
    pub end_sec: Option<u32>,
}

/// What an alert is about. Any field can be empty; the feed fills in only what it means.
#[derive(Debug, Clone, PartialEq)]
pub struct Target {
    pub agency_id: Option<String>,
    pub route_id: Option<String>,
    pub route_type: Option<i32>,
    pub trip_id: Option<String>,
    pub stop_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ServiceAlert {
    pub id: String,
    pub header: Option<String>,
    pub description: Option<String>,
    pub url: Option<String>,
    /// Empty means the alert is always in effect.
    pub periods: Vec<Period>,
    pub targets: Vec<Target>,
}

fn non_empty(value: Option<String>) -> Option<String> {
    value.filter(|v| !v.is_empty())
}

fn clamp_sec(t: u64) -> u32 {
    t.min(u64::from(u32::MAX)) as u32
}

/// The English text if there is one, else the first that is not blank.
fn pick_text(text: Option<TranslatedString>) -> Option<String> {
    let translations = text?.translation;
    let english = translations.iter().find(|t| {
        !t.text.trim().is_empty() && t.language.as_deref().is_some_and(|l| l.to_ascii_lowercase().starts_with("en"))
    });
    english
        .or_else(|| translations.iter().find(|t| !t.text.trim().is_empty()))
        .map(|t| t.text.trim().to_string())
}

/// Every alert in one feed, except ones the feed marks as deleted.
pub fn decode(bytes: &[u8]) -> Result<Vec<ServiceAlert>, prost::DecodeError> {
    let feed = AlertFeed::decode(bytes)?;
    Ok(feed.entity.into_iter().filter(|e| e.is_deleted != Some(true)).filter_map(|e| {
        let a = e.alert?;
        Some(ServiceAlert {
            id: e.id,
            header: pick_text(a.header_text),
            description: pick_text(a.description_text),
            url: pick_text(a.url),
            periods: a.active_period.into_iter()
                .map(|p| Period { start_sec: p.start.map(clamp_sec), end_sec: p.end.map(clamp_sec) })
                .collect(),
            targets: a.informed_entity.into_iter().map(|t| Target {
                agency_id: non_empty(t.agency_id),
                route_id: non_empty(t.route_id),
                route_type: t.route_type,
                trip_id: t.trip.and_then(|trip| non_empty(trip.trip_id)),
                stop_id: non_empty(t.stop_id),
            }).collect(),
        })
    }).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn text(pairs: &[(&str, Option<&str>)]) -> Option<TranslatedString> {
        Some(TranslatedString {
            translation: pairs.iter().map(|(t, l)| Translation { text: (*t).into(), language: l.map(Into::into) }).collect(),
        })
    }

    fn entity(id: &str, alert: Alert) -> AlertEntity {
        AlertEntity { id: id.into(), is_deleted: None, alert: Some(alert) }
    }

    fn empty_alert() -> Alert {
        Alert { active_period: vec![], informed_entity: vec![], url: None, header_text: None, description_text: None }
    }

    fn feed(entities: Vec<AlertEntity>) -> Vec<u8> {
        AlertFeed { entity: entities }.encode_to_vec()
    }

    #[test]
    fn reads_text_periods_and_targets() {
        let bytes = feed(vec![entity("A1", Alert {
            active_period: vec![TimeRange { start: Some(1_790_000_000), end: None }],
            informed_entity: vec![
                EntitySelector { agency_id: None, route_id: Some("R1".into()), route_type: None, trip: None, stop_id: None },
                EntitySelector { agency_id: None, route_id: None, route_type: None, trip: None, stop_id: Some("S9".into()) },
            ],
            url: text(&[("https://x/a1", None)]),
            header_text: text(&[("Trams diverted", Some("en"))]),
            description_text: text(&[("Works on Swanston St", Some("en"))]),
        })]);
        let out = decode(&bytes).unwrap();
        assert_eq!(out.len(), 1);
        let a = &out[0];
        assert_eq!((a.id.as_str(), a.header.as_deref(), a.description.as_deref(), a.url.as_deref()),
                   ("A1", Some("Trams diverted"), Some("Works on Swanston St"), Some("https://x/a1")));
        assert_eq!(a.periods, vec![Period { start_sec: Some(1_790_000_000), end_sec: None }]);
        assert_eq!(a.targets.iter().map(|t| (t.route_id.as_deref(), t.stop_id.as_deref())).collect::<Vec<_>>(),
                   vec![(Some("R1"), None), (None, Some("S9"))]);
    }

    #[test]
    fn prefers_english_then_any_non_blank_text() {
        let bytes = feed(vec![
            entity("A", Alert { header_text: text(&[("Retard", Some("fr")), ("Delay", Some("en-AU"))]), ..empty_alert() }),
            entity("B", Alert { header_text: text(&[("  ", Some("en")), ("Retard", Some("fr"))]), ..empty_alert() }),
            entity("C", Alert { header_text: text(&[("", None)]), ..empty_alert() }),
        ]);
        let out = decode(&bytes).unwrap();
        assert_eq!(out.iter().map(|a| a.header.as_deref()).collect::<Vec<_>>(), vec![Some("Delay"), Some("Retard"), None]);
    }

    #[test]
    fn skips_deleted_alerts_and_entities_without_one() {
        let bytes = feed(vec![
            AlertEntity { id: "gone".into(), is_deleted: Some(true), alert: Some(empty_alert()) },
            AlertEntity { id: "no-alert".into(), is_deleted: None, alert: None },
            entity("kept", empty_alert()),
        ]);
        let out = decode(&bytes).unwrap();
        assert_eq!(out.iter().map(|a| a.id.as_str()).collect::<Vec<_>>(), vec!["kept"]);
    }

    #[test]
    fn reads_trip_and_blank_ids_and_clamps_times() {
        let bytes = feed(vec![entity("A", Alert {
            active_period: vec![TimeRange { start: Some(u64::MAX), end: Some(5) }],
            informed_entity: vec![EntitySelector {
                agency_id: Some("".into()),
                route_id: Some("R".into()),
                route_type: Some(3),
                trip: Some(TripSelector { trip_id: Some("T1".into()) }),
                stop_id: Some("".into()),
            }],
            ..empty_alert()
        })]);
        let a = &decode(&bytes).unwrap()[0];
        assert_eq!(a.periods, vec![Period { start_sec: Some(u32::MAX), end_sec: Some(5) }]);
        let t = &a.targets[0];
        assert_eq!((t.agency_id.as_deref(), t.stop_id.as_deref(), t.trip_id.as_deref(), t.route_type), (None, None, Some("T1"), Some(3)));
    }

    #[test]
    fn rejects_bytes_that_are_not_a_feed() {
        assert!(decode(&[0xFF, 0xFF, 0xFF]).is_err());
    }
}
