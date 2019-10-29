import { DepartAfterQuery } from "./query/DepartAfterQuery";
import { GtfsLoader } from "./gtfs/GtfsLoader";
import { TimeParser } from "./gtfs/TimeParser";
import * as fs from "fs";
import { TransferPatternFactory } from "./pattern/TransferPatternFactory";
import { TransferPatternRepository } from "./pattern/repository/TransferPatternRepository";
import { TimetableLegRepository } from "./pattern/repository/TimetableLegRepository";
import { TransferRepository } from "./pattern/repository/TransferRepository";
import { TransferPatternPlanner } from "./pattern/TransferPatternPlanner";
import { JourneyFactory } from "./journey/JourneyFactory";
import { MultipleCriteriaFilter } from "./query/MultipleCriteriaFilter";
import * as memoize from "memoized-class-decorator";

/**
 * Dependency container
 */
export class Container {

  public async getQuery(): Promise<DepartAfterQuery> {
    const loader = new GtfsLoader(new TimeParser());

    console.time("initial load");
    const gtfs = await loader.load(fs.createReadStream(process.env.GTFS!));
    console.timeEnd("initial load");

    const db = await this.getDatabase();
    const factory = new TransferPatternFactory(
      new TransferPatternRepository(db),
      new TimetableLegRepository(gtfs.trips),
      new TransferRepository(gtfs.transfers),
      gtfs.interchange
    );
    const planner = new TransferPatternPlanner(factory);

    console.log(`Memory usage: ${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`);

    return new DepartAfterQuery(planner, new JourneyFactory(), [new MultipleCriteriaFilter()]);
  }

  @memoize
  public getDatabase() {
    return require("mysql2/promise").createPool({
      host: process.env.DATABASE_HOST || "localhost",
      user: process.env.DATABASE_USER || "root",
      database: process.env.DATABASE_NAME || "ojp",
      password: process.env.DATABASE_PASS || undefined,
      dateStrings: true,
      connectionLimit: 2
    });
  }

  public async end() {
    const db = await this.getDatabase();

    db.end();
  }
}
