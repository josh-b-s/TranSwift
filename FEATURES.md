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
- **Filters.** When a stop has more than one line, chips filter the list by line. When the shown lines head to more than one place, a second row filters by direction. Choosing a line clears a direction it does not serve.
- **Rest of the trip.** Tap a departure to expand the stops it calls at from here on, with the scheduled time at each. Found through the pattern's stop list and a time window, since `stop_times` has no `trip_pk` index.
- **Realtime.** When the feed has TripUpdates URLs and the engine has finished warming up, each departure shows its live time and "4 min late", "On time" or "2 min early", the list is ordered by live time, a trip that is running late stays listed past its scheduled time (the query reaches back 15 minutes), a cancelled trip is struck through and marked Cancelled, and a stop the vehicle will skip says "Not stopping here". The expanded stops of a trip carry the same delays and mark skipped stops. Scheduled times show first and live ones replace them when the feeds answer. A feed that fails leaves the scheduled times in place and logs a warning. Needs no new fetching code: the departures use the same overlay, refreshed at most every 30 seconds, that routing uses, read through the engine's `trip_realtime` call.
- **Station detail.** For a stop that belongs to a station or has a platform code, a collapsible card at the top of the sheet names the station and this platform, lists the station's other platforms with the lines and directions each serves ("96 to Brunswick"), and lists the exits ranked by the quickest route from this platform. Each exit shows an estimated walking time, whether the route is step-free (no stairs or escalators), and numbered directions built from the feed's pathways ("Take the escalator to Concourse, signed "Up to concourse""). Sections the feed has no data for are left out. Needs a feed imported with this version, since the importer now keeps `stop_platforms`, `station_nodes`, `pathways` and `levels`.
- **Behaviour.** Works offline from the timetable. Reloads every minute, honours `calendar` and `calendar_dates` exceptions, includes yesterday's trips that run past midnight, and leaves out trips that end at the stop. Times are scheduled unless the realtime feeds say otherwise, and the sheet says which.

### Saved places

- **Star a place.** A star on the route sheet header saves the destination, and a star on the departures sheet saves a stop. Both are stored in `saved-places.json`.
- **One-tap endpoints.** Tapping an empty start or destination field lists Current location, your saved places under their own labels, then the last 8 places you searched. Picking one sets that end and re-routes.
- **Typing.** Saved places and recents that match the query show first, instantly and offline, followed by the Google results. When a result has the same place id as a stored place, the stored name and coordinates are refreshed; saved labels are kept.
- **Rename and remove.** Settings has a Saved places screen. Rename a place to "Home" or "Work" there; there are no special Home and Work slots.

### Vehicles on the map

- **Live positions.** If a feed has VehiclePositions URLs set (a separate box in its settings, sharing the feed's auth header), vehicles on the routes of the open departures sheet and of the shown journey appear on the map as a badge in the route colour with its name and a dot on the side it is heading. Refreshes every 15 seconds while the map is on screen, and only fetches when there is something to show. The 60 vehicles nearest the middle of the map are drawn.
- **How they are matched.** The engine decodes the feed. A vehicle's trip id finds its route through the timetable, else its route id does. Vehicles are matched to the routes you are looking at by name and route type, so tram 96 and bus 96 stay apart. Positions older than 5 minutes are dropped, and a vehicle repeated across feeds keeps its newest position. A failed refresh keeps the last positions and logs a warning.

### Recording a trip

- **Start trip.** Turns the selected journey into steps (walk to X, ride to Y). A button on the map shows the current step and, on walks, your previous best.
- **Background tracking.** GPS at 1 second or 3 metres, best-for-navigation accuracy, with the background location indicator on.
- **Live pace.** On a walk you have done before between the same two stops, it shows how many seconds ahead of or behind your best you are, once you are past 50 m.
- **Get-off alert.** A notification, "Get off at the next stop", when you reach the stop before yours on a ride.
- **Personal bests and records.** Each repeated walk keeps its best average speed. Finishing a trip reports broken records, either a faster walk between two stops or a longest walk.
- **Trip summary.** A "Trip complete" notification, then a trip screen with the path on a map, distance, duration, average and top speed (GPS spikes above 10 m/s are discarded), and the records you broke.
- **Splits and speed chart.** The trip screen shows walking pace per km or mile, with a partial last split, and a chart of walking speed over the trip's walking time. Time spent riding is not counted in either.
- **Share.** The trip screen ends with a 4:5 picture of the trip (names, date, the route with walks in the app colour and rides in their line colour, walked distance, walking time and average speed). "Share image" rasterises it and opens the system share sheet. "Export GPX" shares the trip as a GPX 1.1 file: one track per leg, with the recorded timed fixes for walks and the followed line (no times) for rides. Uses `expo-sharing`, and `react-native-svg` to draw and rasterise the card.
- **Same trip before.** If you have made the same journey (same first and last stop) more than once, the trip screen lists the runs with walking time and speed, marks the fastest, and links to the others.
- **Simulation.** A location simulator with movement controls lets you test a trip without walking.

### History

- Totals across trips, a bar chart of distance walked, and a bar chart of average speed. A toggle switches the charts between the latest trips, the last 8 weeks (Monday start) and the last 6 months. Quiet periods show as empty bars.
- A walking streak (days in a row with a walk, not broken until a day ends without one) and, if a weekly goal is set, progress towards it.
- A heatmap screen draws every recorded walk on one map in translucent lines, so paths you repeat read darker.
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

- **Preferences.** Theme (system, light, dark), editable walking speed presets (add, edit, reset), maximum walk distance, a weekly walking goal (off by default, 1 km steps), and speed units (km/h or mph). Pace is shown per km or per mile to match.

### Developer tooling

- **Debug visualiser.** Replays a search on the map: BFS rounds and candidate seed paths (flat, per-hop or depth coloured) and RAPTOR route-checks one at a time. The mounts in `index.tsx` are currently commented out, so it is not reachable in the app.
- **Tests.** `npm test` runs 111 tests on Node's built-in runner, including the departures and trip stops queries against the real schema in in-memory SQLite. `cargo test --lib` in `modules/gtfs-router-rust/rust` runs the engine's 27 tests, including the realtime overlay, `trip_realtime` and the vehicle decoder. The same command in `modules/gtfs-importer/rust` runs 2 tests that import a small zip end to end and check the station tables.

## Future features

### Larger

| Feature | What it adds | Notes |
| --- | --- | --- |
| Service alerts | Disruption banners and alerts for saved places | Needs an alerts feed in the same per-feed config as TripUpdates. Pairs with saved places. L |
| Lock-screen trip card | Next step and time remaining on the lock screen | Live Notification on Android is moderate, a Live Activity on iOS is a bigger piece of native work. L |
| Home screen widget or shortcut | "Home to Work" in one tap | Depends on saved places, which now exist. M to L |
| Step-free routing | Avoid stairs, prefer accessible stops | The imported schema has no `wheelchair_boarding`, so the importer and schema change first. The station pathways are now imported, so the step-free test in station detail can be reused. L |
| Crowding | Show how full a service is | VehiclePositions feeds can carry an occupancy status, which the new decoder does not read yet. Add the field, then show it on the departures sheet and vehicle badges. M |

### Needs a new dependency (ask first)

| Feature | Dependency |
| --- | --- |
| Steps and calories | A pedometer sensor package |

### Suggested order

1. Service alerts, which can reuse the per-feed config and the engine overlay approach realtime departures use.
2. Steps and calories, once a pedometer package is chosen.

## Known limits

- Live departure times need the engine to be warm. Before the launch warm-up finishes, or after switching databases and before the next search, the sheet shows scheduled times.
- Realtime on the departures sheet covers trips in the timetable. Added or replacement trips from the feed are used by routing but are not listed on the sheet.
- Stop arrival times in an expanded trip use the departure delay of that stop. Feeds that report different arrival and departure delays at a stop show the departure one.
- Station detail only exists for feeds imported after this change; an older database shows no station card until the feed is imported again. Many feeds have platform codes but no pathways, in which case the exits are listed without routes. Exit times are the feed's traversal times where given, otherwise an estimate from length at 1.2 m/s, otherwise 20 seconds per pathway.
- Vehicles show only for the routes you are already looking at (the open stop, the shown journey), not every vehicle in the feed. There is no "2 stops away" on a departure yet. A feed that sends VehiclePositions without a trip or route id the timetable knows shows nothing.
- "to X" on a departure is the trip's last stop because the schema has no `trip_headsign`.
- Times use the device's time zone, as the router does.
- The debug visualiser still compiles but is unmounted.
- The Rust crate's source comments still call it a port of TS files that were removed. The originals are in git history.
- Tests cover the pure logic and the departures SQL. The map, sheets, native modules and background tracking have only been checked by type-checking, not on a device. That includes the filter chips, expanding departures, the history toggle, the heatmap and the trip screen additions.
- Matched trips compare walking speed and time only. The schema keeps no total trip duration, so time spent riding is not part of the comparison.
- The heatmap loads every saved trip at once and thins each path to a point every 8 m. A very large history may be slow to draw.
