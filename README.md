
Transfer Pattern Journey Planner
=========================
[![Travis](https://img.shields.io/travis/planarnetwork/transfer-pattern-planner.svg?style=flat-square)](https://travis-ci.org/planarnetwork/transfer-pattern-planner) ![npm](https://img.shields.io/npm/v/transfer-pattern-planner.svg?style=flat-square) [![codecov](https://codecov.io/gh/planarnetwork/transfer-pattern-planner/branch/master/graph/badge.svg)](https://codecov.io/gh/planarnetwork/transfer-pattern-planner) ![David](https://img.shields.io/david/planarnetwork/transfer-pattern-planner.svg?style=flat-square)

Implementation of Hannah Bast's [transfer pattern journey planner](https://ad.informatik.uni-freiburg.de/files/transferpatterns.pdf). This repository does not generate transfer patterns, they need to be created in a pre-processing step.

In addition to the algorithm described in the paper this implementation:
 - Checks calendars to ensure services are running on the specified day
 - Origins and destinations may be a set of stops
 - Interchange time at each station is applied
 - Pickup / set down marker of stop times are obeyed
 - Overtaken trains are removed
 - Transfers (footpaths) can be used
 
## Usage

It will work with any well formed GTFS data set.
 
Node +12 is required for all examples.

```
npm install --save transfer-pattern-planner
``` 

### Transfer Patterns

The algorithm expects transfer patterns to be stored in a MySQL compatible table:

```
CREATE TABLE `transfer_patterns` (
  `journey` char(6) NOT NULL,
  `pattern` varchar(255) NOT NULL,
  PRIMARY KEY (`journey`,`pattern`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1
```

Where the journey is the origin and destination concatenated and the pattern are comma separated stops, excluding the origin and destination.

### Environment

The following environment variables can set the database credentials and gtfs file location: 

```
DATABASE_HOST=localhost
DATABASE_USER=root
DATABASE_NAME=jp
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

## Contributing

Issues and PRs are very welcome. To get the project set up run:

```
git clone git@github.com:planarnetwork/transfer-pattern-planner
npm install --dev
npm test
```

If you would like to send a pull request please write your contribution in TypeScript and if possible, add a test.

## License

This software is licensed under [GNU GPLv3](https://www.gnu.org/licenses/gpl-3.0.en.html).

