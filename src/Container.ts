import * as fs from "node:fs";
import { loadGtfs } from "./gtfs/GtfsLoader.js";
import { PatternLoader } from "./pattern/format/PatternLoader.js";
import { DepartAfterQuery } from "./query/DepartAfterQuery.js";
import { StopTable } from "./gtfs/StopTable.js";

/**
 * Reads the feed and the patterns from the paths the environment names.
 *
 * The node convenience. It reads a file system, so it is reached as
 * `transfer-pattern-planner/node` rather than from the package root, along with the rest of what
 * does.
 */
export class Container {

  public async getQuery(): Promise<DepartAfterQuery> {
    console.time("initial load");

    // one table of stations for the two of them, added to by whichever reaches a station first
    const stops = new StopTable();
    const [gtfs, patterns] = await Promise.all([
      loadGtfs(fs.createReadStream(process.env.GTFS ?? "gtfs.zip"), stops),
      new PatternLoader(stops).load(fs.createReadStream(process.env.TRANSFER_PATTERNS ?? "transfer-patterns.br"))
    ]);
    console.timeEnd("initial load");

    console.log(`Memory usage: ${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`);

    return new DepartAfterQuery(gtfs, patterns);
  }

}
