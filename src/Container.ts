import * as fs from "node:fs";
import { loadGtfs } from "./gtfs/GtfsLoader.js";
import { PatternLoader } from "./pattern/repository/PatternLoader.js";
import { DepartAfterQuery } from "./query/DepartAfterQuery.js";
import { StopTable } from "./gtfs/StopTable.js";

/**
 * Reads the feed and the patterns from the paths the environment names.
 *
 * The node convenience, and the only thing in this package that needs a file system, which is why
 * it is reached as `transfer-pattern-planner/node` rather than from the package root. Everything the
 * root exports runs in a browser as readily as in node, and a bundler resolves what it is pointed
 * at whether or not the import turns out to be reachable.
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
