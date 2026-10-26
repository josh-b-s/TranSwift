# TranSwift features

What the app does today, and what could come next. Written from the code as it stands after the router cleanup, the stop departures work and the restructure. Effort is rough: S is hours, M is a day or two, L is a week or more.

## Current features

### Planning a trip

- **Map screen.** Google Maps through `react-native-maps`, with a dark map style in dark mode, a button to jump to your location, and a speedometer.
- **Search.** Start and destination fields with place autocomplete (Google Places), "Current location" as a built-in start or end, and a button to swap them.
- **Pick on the map.** Choose a start or end by moving the map under a pin.
- **Departure time.** Leave now, or pick a day and time with a custom picker (a day strip with hour and minute steppers, used instead of the native date-time picker that crashes on Android).
- **Walking speed.** A pill on the search bar cycles through your walking speed presets, and the router uses the one selected.
- **Walk limit.** A setting for the farthest the router may send you on foot (200 m to 5 km, default 1.68 km). It applies to the next search.
- **Routing.** On-device RAPTOR in Rust, offline, against the GTFS database you imported. It returns several journeys at once, a Pareto set over arrival time, walking distance and transfers.
- **Route sheet.** Lists the journeys with times, duration and walking distance. You can sort by arrival, least walking or fewest transfers. Selecting a journey draws it on the map, with every stop of each ride shown as a white circle ringed in the route colour.
- **Realtime delays.** If a feed has GTFS-Realtime TripUpdates URLs configured, delays are fetched at search time and applied inside the engine. Legs carry a `departureDelaySec`. Failures on one URL don't drop the others.
- **Friendly errors.** Search failures such as no service in the window are mapped to readable messages.

### Stop departures

- **Stop dots.** Zoom in to about 2 km tall and every stop in view gets a circle (up to 150, nearest the centre first), ringed in the colour of the route that serves it most. Circles are not tappable in react-native-maps, so a tap on the map opens the nearest stop within about 22 dp. They hide while a route is shown, while picking on the map and in debug mode.
- **Departures sheet.** Tapping a dot opens a sheet with the next 3 hours of scheduled departures: line badge in the route colour, "to <last stop>", minutes away or clock time, and a header listing the lines that serve the stop.
- **From a planned route.** Tapping a stop dot on a selected route opens the same sheet. The route stop is matched back to the database by position (nearest within 50 m, same name preferred).
- **Behaviour.** Works offline from the timetable. Reloads every minute, honours `calendar` and `calendar_dates` exceptions, includes yesterday's trips that run past midnight, and leaves out trips that end at the stop. Times are scheduled, not live, and the sheet says so.

### Saved places

- **Star a place.** A star on the route sheet header saves the destination, and a star on the departures sheet saves a stop. Both are stored in `saved-places.json`.
- **One-tap endpoints.** Tapping an empty start or destination field lists Current location, your saved places under their own labels, then the last 8 places you searched. Picking one sets that end and re-routes.
- **Typing.** Saved places and recents that match the query show first, instantly and offline, followed by the Google results. When a result has the same place id as a stored place, the stored name and coordinates are refreshed; saved labels are kept.
- **Rename and remove.** Settings has a Saved places screen. Rename a place to "Home" or "Work" there; there are no special Home and Work slots.

### Recording a trip

- **Start trip.** Turns the selected journey into steps (walk to X, ride to Y). A button on the map shows the current step and, on walks, your previous best.
- **Background tracking.** GPS at 1 second or 3 metres, best-for-navigation accuracy, with the background location indicator on.
- **Live pace.** On a walk you have done before between the same two stops, it shows how many seconds ahead of or behind your best you are, once you are past 50 m.
- **Get-off alert.** A notification, "Get off at the next stop", when you reach the stop before yours on a ride.
- **Personal bests and records.** Each repeated walk keeps its best average speed. Finishing a trip reports broken records, either a faster walk between two stops or a longest walk.
- **Trip summary.** A "Trip complete" notification, then a trip screen with the path on a map, distance, duration, average and top speed (GPS spikes above 10 m/s are discarded), and the records you broke.
- **Simulation.** A location simulator with movement controls lets you test a trip without walking.

### History

- Totals across trips, a bar chart of distance walked, and a bar chart of average speed.
- Open any trip, or delete it with a confirmation.

### GTFS data management

- **Multiple databases.** Import a GTFS zip into its own database file. The Rust importer runs natively with per-table progress. Several can exist, one is active, and switching takes effect on the next search.
- **Manage them.** Rename (duplicate names rejected), delete (falls back to the newest remaining), and per-feed stats.
- **Duplicate detection.** The zip is MD5-hashed first, so re-adding an identical feed offers the existing one instead of a long re-import.
- **Browse feeds.** A catalog of feeds from the Mobility Database with search by provider or place and a country filter, importing straight from a download.
- **Suggestions.** Based on where you are, the app can suggest the best catalog feed when none imported covers you, or an update when your feed's timetable is about to end. Imported feeds remember their source for licence credit and update checks.
- **Realtime config.** Per feed, one TripUpdates URL per line and an optional auth header.
- **Caches.** Router and stop caches are reset whenever the active database changes.

### Settings

- **Preferences.** Theme (system, light, dark), editable walking speed presets (add, edit, reset), maximum walk distance, and speed units (km/h or mph). Pace is shown per km or per mile to match.

### Developer tooling

- **Debug visualiser.** Replays a search on the map: BFS rounds and candidate seed paths (flat, per-hop or depth coloured) and RAPTOR route-checks one at a time. The mounts in `index.tsx` are currently commented out, so it is not reachable in the app.
- **Tests.** `npm test` runs 45 tests on Node's built-in runner, including the departures query against the real schema in in-memory SQLite.

## Future features

### Small (no new dependencies)

| Feature | What it adds | Notes |
| --- | --- | --- |
| Departure filters | Filter the sheet by line or direction | Data is already in the result. S |
| Trip splits and speed chart | Per-km splits and speed over time on the trip screen | Timed path samples are already saved. M |
| Weekly and monthly history | A toggle on the History charts, plus streaks and goals such as "walk 10 km this week" | Computed from saved trips. M |
| Heatmap | Every recorded walk drawn on one map | Decode the saved paths. M |
| Matched trips | Compare repeats of the same start and end | `personalBests` already keys legs this way. M |
| Trip from a departure | Tap a departure to see the rest of that trip's stops and times | `stop_times` by trip. M |
| Tests for the rest | Cover `alightAlert`, `personalBests` and the stop-departure edge cases not yet tested | S |

### Larger

| Feature | What it adds | Notes |
| --- | --- | --- |
| Realtime in departures | Delays and cancellations on the departures sheet | Delays are applied inside the Rust engine only. Needs a new engine call that returns delay by trip, not a JS protobuf decoder. L |
| Service alerts | Disruption banners and alerts for saved places | Needs an alerts feed in the same per-feed config as TripUpdates. Pairs with saved places. L |
| Lock-screen trip card | Next step and time remaining on the lock screen | Live Notification on Android is moderate, a Live Activity on iOS is a bigger piece of native work. L |
| Home screen widget or shortcut | "Home to Work" in one tap | Depends on saved places, which now exist. M to L |
| Step-free routing | Avoid stairs, prefer accessible stops | The imported schema has no `wheelchair_boarding`, so the importer and schema change first. L |
| Crowding | Show how full a service is | Needs a realtime occupancy feed. Leave until live data is in. L |
| Station detail | Which side to board, which exit to take | GTFS `pathways` and levels would need importing. L |

### Needs a new dependency (ask first)

| Feature | Dependency |
| --- | --- |
| Share a trip card as an image, GPX export | A sharing library such as `expo-sharing`, and a way to render the card |
| Steps and calories | A pedometer sensor package |

### Suggested order

1. History extras (splits, weekly view, heatmap), since the data is already stored.
2. Realtime in departures, as its own project, followed by alerts.

## Known limits

- Departure sheets show scheduled times only, and "to X" is the trip's last stop because the schema has no `trip_headsign`.
- Times use the device's time zone, as the router does.
- The debug visualiser still compiles but is unmounted.
- The Rust crate's source comments still call it a port of TS files that were removed. The originals are in git history.
- Tests cover the pure logic and the departures SQL. The map, sheets, native modules and background tracking have only been checked by type-checking, not on a device.
