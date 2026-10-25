# Router

A GTFS journey planner where per-rider walking speed actually changes the
route. No transit API exposes that as an input, so this rolls its own
RAPTOR instead of wrapping one.

<!--
GIF placeholders, drop screen recordings here once captured.
Suggested shots: (1) searching a trip and getting results, (2) the walking-speed
setting changing the returned route, (3) the debug map overlay showing the
BFS corridor / candidate paths.

![Search and route results](docs/gifs/search-demo.gif)
![Walking speed changes the route](docs/gifs/walking-speed-demo.gif)
![Debug corridor overlay](docs/gifs/debug-overlay-demo.gif)
-->

## At a glance

- **What it is:** a mobile trip planner (React Native / Expo) that runs a
  full custom transit-routing engine on-device, offline, against raw GTFS
  data. No third-party directions API involved.
- **Why it's interesting:** the routing pipeline (below) is a from-scratch
  implementation of a published algorithm (RAPTOR) plus several original
  pre-processing stages, built to fix real performance failures (OOM,
  multi-second queries) rather than designed on paper first.
- **Stack:** React Native + Expo Router, TypeScript, Redux Toolkit,
  NativeWind (Tailwind for RN), `react-native-maps`, on-device SQLite
  (`op-sqlite`) for the preprocessed GTFS store, and two custom **Rust**
  native modules (GTFS import and the RAPTOR router itself), bridged into RN
  via `uniffi-bindgen-react-native`.
- **My role:** designed and built the routing pipeline end to end
  (preprocessing, graph construction, search, scoring, RAPTOR, Rust/RN
  bridge) as well as the app UI.

## Why

Started as a PTV-meets-Strava idea: your own walking pace, not a fixed
default, should change which route is fastest.

## Design process

**Attempt 1: plain RAPTOR, full feed loaded.** OOM'd, or once that was
avoided, too slow reading off disk. A search should never touch the whole
regional stop_times table. The fix has to happen before RAPTOR runs.

**Attempt 2: ellipse filter.** Only load stops inside an ellipse between
origin and destination. Broke on the obvious case: a lake, a river with no
crossing, anything with a geographic gap but no network gap. An ellipse
assumes reachability falls off with straight-line distance. That's true for
walking, false for transit. Two stops close on a map can be far apart in the
actual service graph.

**Attempt 3: straightness-scored candidates.** Score candidate paths by how
directly they point at the destination. Still geometric. A straight-looking
path can be a trap if it only connects via an infrequent line. An indirect
one can be fastest if it hits an express service.

**Attempt 4: BFS-seeded corridor, current design.** Let the transit graph's
own connectivity and timing drive the search. Keep geometry only for what's
actually physical: walking radii, footpath transfers. Geometry is a valid
local signal (how far can you walk from here) but not a valid global one
(is this whole path good). The ellipse's mistake was using a local signal
globally.

## Current pipeline

1. **Preprocessing.** GTFS zip preprocessed once into a SQLite DB of pure
   timetable data, plus a precomputed average ride time and average wait time
   (half headway) per line. Patterns dedup by real stop/time sequence, not
   just by route.

2. **Coarse graph.** Built once, persisted, reused across engine lifetimes.
   One edge per unique line (not per pattern), plus walking edges between
   nearby stops. Small enough to stay resident; the full timetable isn't.

3. **Seeding.** Origin and destination matched to every stop within the
   caller's max walking distance, deduped so two stops on the same ride keep
   only the closer one.

4. **Balanced bidirectional BFS.** Two trees grow at once, forward from
   origin and backward from destination, expanding whichever side's current
   frontier is smaller. A level advances only on a real transit edge; walking
   folds in as a free same-level closure. Transit edges are directional, so the
   backward side walks a precomputed reverse adjacency instead of riding lines
   backwards. Once the trees meet, both keep expanding until the combined
   level passes the meeting point by a safety margin, so sibling routes and
   one-more-transfer alternatives aren't dropped on the first meet.

5. **Edge corridor.** Past the seed paths, the BFS also collects every edge
   within that same margin, seed path or not. RAPTOR loads the seed paths'
   patterns plus these edge patterns. Logs have shown the actual best journey
   regularly rides a pattern that was never on a seed path, so this step isn't
   optional.

6. **Candidate scoring and time window.** Each candidate path is scored with
   the caller's walking speed plus each line's average ride and wait time. The
   5th-fastest scoreable candidate sets the reference score for the real
   timetable query's time window: a 10-minute floor plus 25% of that reference,
   capped at 8 hours, widened in stages if nothing active turns up.

7. **Loader filters.** Patterns with no active trip today get dropped first,
   then a headway filter and a pattern cap apply. Only what survives corridor,
   window, and these filters gets loaded into RAPTOR's in-memory index.

8. **RAPTOR search.** Standard round-based RAPTOR, Pareto frontier at the
   destination only (arrival time, walking distance, transfers), zero SQL
   during the search itself. Two approximations live here on purpose: a
   destination-distance lower bound prunes marked stops once any candidate is
   known, and a frontier cap thins marked stops once a round gets too busy.
   Both can in theory drop the true optimum for bounded worst-case cost. See
   raptor.rs for exactly when that risk is real.

9. **Verifier fallback.** Candidate paths get independently re-walked at the
   caller's real walking speed as a sanity check on the main search.

## Standard vs bespoke

RAPTOR and the Pareto-frontier variant are both published, well-known
techniques, not invented here. What's bespoke is everything before RAPTOR
runs: the balanced bidirectional seed BFS, the edge corridor expansion, and
sizing the time window off the Nth-fastest seed candidate. That combination
isn't a named algorithm. It's the part that got shaped by hitting real OOM
and latency walls, not designed on paper first.

## Running it

```bash
npm install
npm run android   # or: npm run ios / npm run web
```

The Rust native modules (`modules/gtfs-importer`, `modules/gtfs-router-rust`)
build via `uniffi-bindgen-react-native`, see their `npm run build:*` scripts
in `package.json`. GTFS data can be preprocessed either with
`npm run preprocess-gtfs` or from within the app itself, via the GTFS
settings screen (`app/(tabs)/settings/gtfs.tsx`).

Unit tests run with `npm test` (node's built-in runner, no extra dependencies). They cover the stop
departures query against the real GTFS schema in an in-memory SQLite, the stop cache, and the trip maths.

## Layout

- `app/` Expo Router screens.
- `components/` grouped by feature: `debug`, `map`, `search`, `sheets`, `trip`, `ui`.
- `hooks/` React hooks that glue services to screens.
- `services/gtfs/` `core` (stop cache, keys, route types), `router` (Rust engine adapter, warm-up, result types),
  `departures`, `import`, `catalog`, `suggestion`, `realtime`, `debug`.
- `store/` Redux slices. `scripts/` GTFS preprocessing. `tests/` unit tests.