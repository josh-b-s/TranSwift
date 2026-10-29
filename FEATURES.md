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

- **Stop dots.** Zoom in until the map is 0.05 degrees of latitude tall, about 5.5 km, and every stop in view gets a circle (up to 150, nearest the centre first), ringed in the colour of the route that serves it most. Circles are not tappable in react-native-maps, so a tap on the map opens the nearest stop within about 22 dp. They hide while a route is shown, while picking on the map and in debug mode.
- **Departures sheet.** Tapping a dot opens a sheet with the next 3 hours of scheduled departures: line badge in the route colour, "to <headsign>", which is the trip's own headsign when the feed has one and otherwise its last stop,, minutes away or clock time, and a header listing the lines that serve the stop.
- **From a planned route.** Tapping a stop dot on a selected route opens the same sheet. The route stop is matched back to the database by position (nearest within 50 m, same name preferred).
- **Filters.** When a stop has more than one line, chips filter the list by line. When the shown lines head to more than one place, a second row filters by direction. Choosing a line clears a direction it does not serve.
- **Rest of the trip.** Tap a departure to expand the stops it calls at from here on, with the scheduled time at each. Found through the pattern's stop list and a time window, since `stop_times` has no `trip_pk` index.
- **Realtime.** When the feed has TripUpdates URLs, each departure shows its live time and "4 min late", "On time" or "2 min early", the list is ordered by live time, a trip that is running late stays listed past its scheduled time (the query reaches back 15 minutes), a cancelled trip is struck through and marked Cancelled, and a stop the vehicle will skip says "Not stopping here". The expanded stops of a trip carry delays and mark skipped stops: the first stop's time takes the departure delay and the later ones take the arrival delay. Scheduled times show first and live ones replace them when the feeds answer, including after a warm-up that is still running finishes. The engine warms up again in the background whenever the active database changes, so live times do not wait for a search. A feed that fails leaves the scheduled times in place and logs a warning. Needs no new fetching code: the departures use the same overlay, refreshed at most every 30 seconds, that routing uses, read through the engine's `trip_realtime` call.
- **Stops away.** When the feed has VehiclePositions URLs and a vehicle reports its trip id and the stop sequence it is at or heading to, its departure says "3 stops away", or "Arriving" when this stop is its current or next one. Counted in the pattern's stops, so sequences that skip numbers count correctly. It reads the vehicles the map already tracks, so it costs no extra requests and refreshes with them every 15 seconds. A vehicle already past the stop, or one that reports no trip or stop sequence, shows nothing.
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

### Service alerts

- **Where they show.** If a feed has ServiceAlerts URLs set, the departures sheet lists the alerts for that stop or for any route serving it, and the selected journey card lists the alerts for the routes on its legs. Each is an amber row with the headline; tap it to read the description.
- **How they are matched.** The engine decodes the feed, preferring English text and otherwise the first translation, and skips alerts the feed marks as deleted. Only alerts in effect now are kept. A route alert is matched by route name and type, as vehicles are. Refreshes every minute while a sheet is open, and one fetch is shared between the two screens for 30 seconds.

### Recording a trip

- **Start trip.** Turns the selected journey into steps (walk to X, ride to Y). A button on the map shows the current step and, on walks, your previous best.
- **Background tracking.** GPS at 1 second or 3 metres, best-for-navigation accuracy, with the background location indicator on.
- **Live pace.** On a walk you have done before between the same two stops, it shows how many seconds ahead of or behind your best you are, once you are past 50 m.
- **Get-off alert.** A notification, "Get off at the next stop", when you reach the stop before yours on a ride. A one-stop ride, with nothing between boarding and alighting, alerts about a minute before arriving instead: from distance over speed while the vehicle is moving, otherwise from the planned arrival time, and within 100 m of the stop as a last resort.
- **Personal bests and records.** Each repeated walk keeps its best average speed. Finishing a trip reports broken records, either a faster walk between two stops or a longest walk.
- **Trip summary.** A "Trip complete" notification, then a trip screen with the path on a map, distance, duration, average and top speed (GPS spikes above 10 m/s are discarded), and the records you broke.
- **Splits and speed chart.** The trip screen shows walking pace per km or mile, with a partial last split, and a chart of walking speed over the trip's walking time. Time spent riding is not counted in either.
- **Share.** The trip screen ends with a 4:5 picture of the trip (names, date, the route with walks in the app colour and rides in their line colour, walked distance, walking time and average speed). "Share image" rasterises it and opens the system share sheet. "Export GPX" shares the trip as a GPX 1.1 file: one track per leg, with the recorded timed fixes for walks and the followed line (no times) for rides. Uses `expo-sharing`, and `react-native-svg` to draw and rasterise the card.
- **Same trip before.** If you have made the same journey (same first and last stop) more than once, the trip screen lists the runs with total time, walking time and speed, marks the quickest run and the fastest walk, and links to the others. Total time runs from start to finish, riding included, and exists only for trips saved after end times were added.
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
- **Realtime config.** Per feed, five cards: Trip updates, Vehicle positions, Service Alerts, an optional Header ("Name: value") and an optional Query key ("name=value"). The query key is added to each URL when it is fetched, unless the URL already has that parameter. Each URL card has one box per URL: a spare box always waits at the end, Enter moves to the next one, pasted lines split into boxes and an emptied box disappears. "Fill from Mobility Database" fills the three URL lists from the catalog, merged with what is already there. Importing a feed from Browse Feeds fills them automatically, and replacing a feed keeps its realtime settings. When the catalog says the producer wants a key, the hint (which header or query parameter) is saved with the feed. A 401 or 403 from a realtime URL opens an alert, once per feed per launch, saying where the key goes and offering the feeds screen.
- **Caches.** Router and stop caches are reset whenever the active database changes.

### Settings

- **Preferences.** Theme (system, light, dark), editable walking speed presets (add, edit, reset), maximum walk distance, a weekly walking goal (off by default, 1 km steps), and speed units (km/h or mph). Pace is shown per km or per mile to match.

### Developer tooling

- **Debug visualiser.** Replays a search on the map: BFS rounds and candidate seed paths (flat, per-hop or depth coloured) and RAPTOR route-checks one at a time. The mounts in `index.tsx` are currently commented out, so it is not reachable in the app.
- **Tests.** `npm test` runs 158 tests on Node's built-in runner, including the departures and trip stops queries against the real schema in in-memory SQLite. `cargo test --lib` in `modules/gtfs-router-rust/rust` runs the engine's 33 tests, including the realtime overlay, `trip_realtime`, and the vehicle and alert decoders. The same command in `modules/gtfs-importer/rust` runs 3 tests that import a small zip end to end and check the station tables and trip headsigns.

## Future features

### Larger

| Feature | What it adds | Notes |
| --- | --- | --- |
| Alerts for saved places | List the service alerts that touch a starred stop | Service alerts now show on the departures sheet and the journey card. This would add a view across saved stops. M |
| Lock-screen trip card | Next step and time remaining on the lock screen | Live Notification on Android is moderate, a Live Activity on iOS is a bigger piece of native work. L |
| Home screen widget or shortcut | "Home to Work" in one tap | Depends on saved places, which now exist. M to L |
| Step-free routing | Avoid stairs, prefer accessible stops | The imported schema has no `wheelchair_boarding`, so the importer and schema change first. The station pathways are now imported, so the step-free test in station detail can be reused. L |
| Crowding | Show how full a service is | VehiclePositions feeds can carry an occupancy status, which the new decoder does not read yet. Add the field, then show it on the departures sheet and vehicle badges. M |

### Needs a new dependency (ask first)

| Feature | Dependency |
| --- | --- |
| Steps and calories | A pedometer sensor package |

### Suggested order

1. Steps and calories, once a pedometer package is chosen.

## Known limits

### Realtime and vehicles

- Realtime on the departures sheet covers trips in the timetable. Added or replacement trips from the feed are used by routing but are not listed on the sheet.
- Vehicles show only for the routes you are already looking at (the open stop, the shown journey), not every vehicle in the feed. A feed that sends VehiclePositions without a trip or route id the timetable knows shows nothing.
- "Stops away" needs the vehicle to report both a trip id and its current stop sequence. It cannot tell a vehicle stopped at the stop from one arriving at it, so both read "Arriving".
- The warm-up that live departures wait for costs about 12 seconds of background work each time the active database changes.
- Headsigns are stored when a feed is imported. A database imported before that still shows each trip's last stop until the feed is imported again.

### Service alerts

- Alerts for one trip, a whole agency or a route type are not shown. An alert that names a stop and a route counts as a stop alert, so it appears on the departures sheet but not on journeys.
- A journey leg carries stop names, not ids, so the journey card shows route alerts only.
- Alerts attach to routes by name and type, so two routes with the same name and type, for example from different operators, share their alerts.
- Alert links and causes are not shown.

### Realtime setup

- The catalog columns for realtime feeds (`entity_type`, `static_reference`, `urls.direct_download` and the key hints) are named from the Mobility Database documentation and have not been checked against a live copy of the file. If a name is wrong, the fill finds nothing instead of failing.
- The key alert fires for a 401 or 403 only. It shows once per feed per launch, and again after you save that feed's realtime settings.

### Trips and the get-off alert

- The planned arrival time behind a one-stop alert carries the delays known when the journey was planned. It is not refreshed during the ride, so the live part is distance over speed.
- A ride with no stop list, as some feeds give, never alerts.
- Alerts depend on GPS fixes arriving. A phone that stops getting fixes will not alert.
- Trips saved before end times were added have no total time, so they cannot be called quickest and show walking figures only.
- The heatmap loads every saved trip at once and thins each path to a point every 8 m. A very large history may be slow to draw.

### Data and the rest

- Station detail only exists for feeds imported after it was added; an older database shows no station card until the feed is imported again, because pathways were not stored. Many feeds have platform codes but no pathways, in which case the exits are listed without routes. Exit times are the feed's traversal times where given, otherwise an estimate from length at 1.2 m/s, otherwise 20 seconds per pathway.
- Times use the device's time zone, as the router does, not the agency's.
- The debug visualiser still compiles but is unmounted.
- The Rust modules' headers no longer name removed TypeScript files, but about 20 inline comments still compare with "the TS version". The originals are in git history.
- Tests cover the pure logic and the departures SQL. The map, sheets, native modules and background tracking have only been checked by type-checking, not on a device. That includes the filter chips, expanding departures, the history toggle, the heatmap, the trip screen additions, the service alert rows, stops away and the realtime setup cards. The type check reports errors only where the generated native bindings are missing, which they are until a native build.
