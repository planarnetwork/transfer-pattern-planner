
Transfer Pattern Journey Planner
=========================
[![Test](https://github.com/planarnetwork/transfer-pattern-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/planarnetwork/transfer-pattern-planner/actions/workflows/ci.yml) ![npm](https://img.shields.io/npm/v/transfer-pattern-planner.svg?style=flat-square)

Implementation of Hannah Bast's [transfer pattern journey planner](https://ad.informatik.uni-freiburg.de/files/transferpatterns.pdf). Transfer patterns are generated in a pre-processing step, which `npm run patterns` does.

In addition to the algorithm described in the paper this implementation:
 - Checks calendars to ensure services are running on the specified day
 - Origins and destinations may be a set of stations
 - Interchange time at each station is applied
 - Pickup / set down marker of stop times are obeyed
 - Overtaken trains are removed
 - Footpaths from `transfers.txt` can be used
 - Journeys are planned between stations, and the platforms are retained for display
 - A vehicle that carries on as another service is planned as one trip rather than a change

## Usage

It will work with any well formed GTFS data set.

Node 22 or later is required for all examples.

```
npm install --save transfer-pattern-planner
```

The package ships both CommonJS and ES modules, so `require` and `import` both work. The examples
below use `require`; the equivalent `import` is the same names from the same place.

Everything the package root exports runs in a browser as readily as in node: the feed and the
patterns are both read from whatever the environment can give bytes from, and decompressed with
`DecompressionStream`, which each of them has. The one exception is `Container`, which reads paths
off the file system and so lives at `transfer-pattern-planner/node`.

Reading the feed is [`@gb-transit/gtfs-loader`](https://www.npmjs.com/package/@gb-transit/gtfs-loader)'s
job, and it is the only dependency.

### Stations and platforms

A transfer pattern names the stations a journey calls at, so the feed is resolved to stations before
it is indexed. A stop that gives a `parent_station` is read as belonging to it, and a station is
named by its `stop_code` where it has one - that is the code patterns are stored against. `gtfs.stations`
maps every feed stop id to the station it belongs to.

The stop times themselves are left as the feed published them, so a leg between two stations still
says which platform it uses at each end, and a call the vehicle only passes through is not somewhere
a journey can start or end.

Footpaths and interchange times come from `transfers.txt`: a row from a stop back to itself is the
interchange time at that station, and a row between two stations is a footpath. A row of
`transfer_type` 4 says a vehicle carries on as another trip, and the trip a passenger stays on
across that coupling is planned as one trip alongside the two portions, which still run alone on the
days the other does not.

### Transfer Patterns

The patterns come from a file, which is written once for a feed and a date:

```
npm run patterns gtfs.zip 2026-09-15 transfer-patterns.br
```

That plans a whole day from every station in the feed, on a pool of workers sharing one timetable.
It uses [raptor](https://github.com/planarnetwork/raptor) to do the scanning, which is a
devDependency: generating patterns is a job for a checkout of this repository rather than for
something that has installed it, so the published package still depends only on the feed loader.
`WORKERS` sets how many threads to use, and defaults to two fewer than the machine has cores.

Each line is one pattern: the stations it calls at, three characters each, with nothing between
them. The two ends are written in alphabetical order, so a pattern appears once for both directions
of travel and a journey from Norwich is found under `LST`, read the other way. Sorting puts patterns
that begin the same way together, so a line only records how many leading stations it takes from the
line above and what follows it:

```
0LSTNRW
2CBGNRW           <- LST, then CBG NRW
3ELYNRW           <- LST CBG, then ELY NRW
```

The file is brotli compressed. A national feed comes to about 33MB for 34 million patterns, which
`loadTransferPatterns` reads into an index of the stations between each pair of ends.

Because a station is three characters, this needs a feed whose `stop_code` is one - a CRS code, for
the GB rail feeds this is built for.

### Environment

The following environment variables set where the feed and the patterns are read from:

```
GTFS=/path/to/gtfs.zip
TRANSFER_PATTERNS=/path/to/transfer-patterns.br
```

### Depart After Query

Find the first results that depart after a specific time

```javascript
const { Container } = require("transfer-pattern-planner/node");

const container = new Container();
const query = await container.getQuery();
const results = query.plan(
    ["BHM", "BMO", "BSW", "BHI"],
    ["NRW"],
    new Date(),
    3600 * 10 // time of day in seconds
);
```

### Wiring it up yourself

The container is a convenience. `createQuery` is the whole of the wiring between having a feed and
its patterns and being able to plan:

```javascript
const fs = require("fs");
const { createQuery, loadGtfs, loadTransferPatterns, stopTable } = require("transfer-pattern-planner");

// one table of stations for the two of them, added to by whichever reaches a station first
const stops = stopTable();
const [gtfs, patterns] = await Promise.all([
  loadGtfs(fs.createReadStream("gtfs.zip"), stops),
  loadTransferPatterns(fs.createReadStream("transfer-patterns.br"), { stops })
]);

const query = createQuery(gtfs, patterns, stops);
const journeys = query.plan(["NRW"], ["LST"], new Date(), 9 * 60 * 60);
```

Use `toGtfsData(feed, stops)` if you already have a feed from `@gb-transit/gtfs-loader`, and pass
your own `JourneyFilter[]` as the fourth argument to `createQuery` to replace the default
`MultipleCriteriaFilter`.

### Stations, and how they are named

A station is a three character code in the feed and in the pattern file, and a number everywhere
between a query and its results: the query exchanges the codes it was asked in for those numbers,
and the legs of a journey are named again on the way out. That numbering is the `stopTable` above,
which the feed and the patterns are both read against so that they speak of a station the same way.
The two files are still read at the same time - whichever reaches a station first numbers it.

Patterns can come from somewhere other than a file: `TransferPatternRepository` is a single method
returning the patterns between two stations, and `InMemoryTransferPatternRepository` is the one that
answers from a loaded file.

### In the browser

Nothing here needs a file system. Fetch the feed and the patterns at the same time and the two
downloads overlap, each parsed as it arrives rather than after it has all been collected:

```javascript
import { loadGTFSFromUrl } from "@gb-transit/gtfs-loader";
import { loadTransferPatternsFromUrl, toGtfsData, createQuery, stopTable } from "transfer-pattern-planner";

const stops = stopTable();
const [gtfs, patterns] = await Promise.all([
  loadGTFSFromUrl("/gtfs.zip").then(feed => toGtfsData(feed, stops)),
  loadTransferPatternsFromUrl("/transfer-patterns.br", { stops })
]);

const query = createQuery(gtfs, patterns, stops);
const journeys = query.plan(["NRW"], ["LST"], new Date(), 9 * 60 * 60);
```

Both files have to be readable by the page, which means the host either serves them from the same
origin or sends an `Access-Control-Allow-Origin` header.

The pattern file is decompressed with `DecompressionStream("brotli")`. A host that would rather send
it with `Content-Encoding: br` can, and the browser will have decoded the body before this sees it -
that is noticed from the header rather than decompressing what is already plain. Pass
`{ compressed: false }` to say so for a file that arrives decompressed some other way.

`loadTransferPatterns` takes the same sources the feed loader does - a `Response`, a
`ReadableStream`, a `Blob`, the bytes, or a node stream.

## Contributing

Issues and PRs are very welcome. To get the project set up run:

```
git clone git@github.com:planarnetwork/transfer-pattern-planner
npm install
npm test
```

`npm test` lints with [biome](https://biomejs.dev/), typechecks, and runs the unit tests with
[vitest](https://vitest.dev/). `npm run watch-test` reruns them as you edit.

If you would like to send a pull request please write your contribution in TypeScript and if possible, add a test.

## License

This software is licensed under [GNU GPLv3](https://www.gnu.org/licenses/gpl-3.0.en.html).
