
Transfer Pattern Journey Planner
=========================
[![Travis](https://img.shields.io/travis/planarnetwork/transfer-pattern-planner.svg?style=flat-square)](https://travis-ci.org/planarnetwork/transfer-pattern-planner) ![npm](https://img.shields.io/npm/v/transfer-pattern-planner.svg?style=flat-square) ![David](https://img.shields.io/david/planarnetwork/transfer-pattern-planner.svg?style=flat-square)



 - Calendars are checked to ensure services are running on the specified day
 - The origin and destination may be a set of stops
 - Interchange time at each station is applied
 - Pickup / set down marker of stop times are obeyed
 - Multi-criteria journey filtering
 - Transfers (footpaths) can be used
 
## Usage

It will work with any well formed GTFS data set.
 
Node +11 is required for all examples.

```
npm install --save transfer-pattern-planner
``` 

### Depart After Query

Find the first results that depart after a specific time

```javascript
const {GtfsLoader, JourneyFactory, ConnectionScanAlgorithm, ScanResultsFactory, TimeParser, MultipleCriteriaFilter, DepartAfterQuery} = require("transfer-pattern-planner");

const gtfsLoader = new GtfsLoader(new TimeParser());
const gtfs = await gtfsLoader.load(fs.createReadStream("gtfs.zip"));
const csa = new ConnectionScanAlgorithm(gtfs.connections, gtfs.transfers, new ScanResultsFactory(gtfs.interchange));
const query = new DepartAfterQuery(csa, new JourneyFactory(), [new MultipleCriteriaFilter()]);
const results = query.plan(["TBW"], ["NRW"], new Date(), 9 * 3600);
```

## TODO

- Short circuit connection scan once all destinations found
- Fake trip ID for transfers to (removes branch)
- Only scan transfers for stops once (avoid re-scan when time is improved)

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

# Notes

// Too much flat map?? Might be faster with mutable list

Remove patterns where a group station that is not the origin is included in the pattern
Remove patterns where a group station that is not the destination is included in the pattern

For every origin
  Merge patterns into a tree
  
Start dumb
 - List of lists
    - Get seed legs 
    - Optimise leg search by storing current index
 - Then go to a tree
 - Optimise by removing unnecessary group patterns
 