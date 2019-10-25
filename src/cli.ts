import * as fs from "fs";
import { GtfsLoader } from "./gtfs/GtfsLoader";
import { TimeParser } from "./gtfs/TimeParser";
import { JourneyFactory } from "./journey/JourneyFactory";
import { DepartAfterQuery } from "./query/DepartAfterQuery";
import { MultipleCriteriaFilter } from "./query/MultipleCriteriaFilter";
import { Journey } from "./journey/Journey";
import { TransferPatternPlanner } from "./pattern/TransferPatternPlanner";
import { TransferPatternFactory } from "./pattern/TransferPatternFactory";
import { TransferPatternRepository } from "./pattern/repository/TransferPatternRepository";
import { TimetableLegRepository } from "./pattern/repository/TimetableLegRepository";
import { TransferRepository } from "./pattern/repository/TransferRepository";

async function main() {
  const loader = new GtfsLoader(new TimeParser());

  console.time("initial load");
  const gtfs = await loader.load(fs.createReadStream("/home/linus/Downloads/gb-rail-latest.zip"));
  console.timeEnd("initial load");

  const db = await getDatabase();
  const factory = new TransferPatternFactory(
    new TransferPatternRepository(db),
    new TimetableLegRepository(gtfs.trips),
    new TransferRepository(gtfs.transfers),
    gtfs.interchange
  );
  const planner = new TransferPatternPlanner(factory);
  const query = new DepartAfterQuery(planner, new JourneyFactory(), [new MultipleCriteriaFilter()]);

  console.time("query");
  const results = await query.plan(["TBW"], ["NRW"], new Date(), 3600 * 4 + 1800);
  console.timeEnd("query");

  db.end();
  results.forEach(result => console.log(journeyToString(result)));
}

function journeyToString(j: Journey) {
  return toTime(j.departureTime) + ", " +
    toTime(j.arrivalTime) + ", " +
    [j.legs[0].origin, ...j.legs.map(l => l.destination)].join("-");
}

function toTime(time: number) {
  let hours: any   = Math.floor(time / 3600);
  let minutes: any = Math.floor((time - (hours * 3600)) / 60);
  let seconds: any = time - (hours * 3600) - (minutes * 60);

  if (hours   < 10) { hours   = "0" + hours; }
  if (minutes < 10) { minutes = "0" + minutes; }
  if (seconds < 10) { seconds = "0" + seconds; }

  return hours + ":" + minutes + ":" + seconds;
}

function getDatabase() {
  return require("mysql2/promise").createPool({
    host: "localhost",
    user: "root",
    database: "ojp",
    dateStrings: true,
    connectionLimit: 2
  });
}

main().catch(e => console.error(e));
