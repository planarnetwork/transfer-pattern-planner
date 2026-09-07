
Transfer Pattern Journey Planner
=========================
[![Test](https://github.com/planarnetwork/transfer-pattern-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/planarnetwork/transfer-pattern-planner/actions/workflows/ci.yml) ![npm](https://img.shields.io/npm/v/transfer-pattern-planner.svg?style=flat-square)

Implementation of Hannah Bast's [transfer pattern journey planner](https://ad.informatik.uni-freiburg.de/files/transferpatterns.pdf). This repository does not generate transfer patterns, they need to be created in a pre-processing step.

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

Reading the feed is [`@gb-transit/gtfs-loader`](https://www.npmjs.com/package/@gb-transit/gtfs-loader)'s
job. `mysql2` is used to read the transfer patterns.

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

The algorithm expects transfer patterns to be stored in a MySQL compatible table:

```
CREATE TABLE `transfer_patterns` (
  `journey` char(6) NOT NULL,
  `pattern` varchar(255) NOT NULL,
  PRIMARY KEY (`journey`,`pattern`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1
```

Where the journey is the origin and destination station concatenated and the pattern are comma
separated stations, excluding the origin and destination. The `char(6)` key assumes stations are
named by a three character code, as they are in a feed whose `stop_code` is a CRS code.

`docker-compose up` starts a database to hold them.

### Environment

The following environment variables can set the database credentials and gtfs file location:

```
DATABASE_HOST=localhost
DATABASE_USER=root
DATABASE_NAME=ojp
DATABASE_PASS=
GTFS=/path/to/gtfs.zip
```

### Depart After Query

Find the first results that depart after a specific time

```javascript
const { Container } = require("transfer-pattern-planner");

const container = new Container();
const query = await container.getQuery();
const results = await query.plan(
    ["BHM", "BMO", "BSW", "BHI"],
    ["NRW"],
    new Date(),
    3600 * 10 // time of day in seconds
);

await container.end(); // database connection must be closed
```

`container.getInMemoryQuery()` does the same but reads every pattern into memory first, which
answers queries faster at the cost of the memory to hold them.

### Wiring it up yourself

The container is a convenience. The pieces can be assembled directly, which is what you want if the
patterns come from somewhere other than the database:

```javascript
const fs = require("fs");
const {
  loadGtfs, JourneyFactory, DepartAfterQuery, MultipleCriteriaFilter, TimetableLegRepository,
  TransferRepository, TransferPatternFactory, TransferPatternPlanner, InMemoryTransferPatternRepository
} = require("transfer-pattern-planner");

const gtfs = await loadGtfs(fs.createReadStream("gtfs.zip"));
// or toGtfsData(feed) if you already have a feed from @gb-transit/gtfs-loader

// direct, and one changing at CBG
const patterns = new InMemoryTransferPatternRepository({ LST: { NRW: ["", "CBG"] } });

const factory = new TransferPatternFactory(
  patterns,
  new TimetableLegRepository(gtfs.trips),
  new TransferRepository(gtfs.transfers),
  gtfs.interchange
);
const query = new DepartAfterQuery(
  new TransferPatternPlanner(factory),
  new JourneyFactory(),
  [new MultipleCriteriaFilter()]
);

const journeys = await query.plan(["NRW"], ["LST"], new Date(), 9 * 60 * 60);
```

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
