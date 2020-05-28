import { DepartAfterQuery } from "./query/DepartAfterQuery";
import { GtfsData, GtfsLoader } from "./gtfs/GtfsLoader";
import { TimeParser } from "./gtfs/TimeParser";
import * as fs from "fs";
import { TransferPatternFactory } from "./pattern/TransferPatternFactory";
import { DatabaseTransferPatternRepository } from "./pattern/repository/DatabaseTransferPatternRepository";
import { TimetableLegRepository } from "./pattern/repository/TimetableLegRepository";
import { TransferRepository } from "./pattern/repository/TransferRepository";
import { TransferPatternPlanner } from "./pattern/TransferPatternPlanner";
import { JourneyFactory } from "./journey/JourneyFactory";
import { MultipleCriteriaFilter } from "./query/MultipleCriteriaFilter";
import * as memoize from "memoized-class-decorator";
import { InMemoryTransferPatternRepositoryFactory } from "./pattern/repository/InMemoryTransferPatternRepository";
import { TransferPatternRepository } from "./pattern/repository/TransferPatternRepository";

/**
 * Dependency container
 */
export class Container {

  public async getQuery(): Promise<DepartAfterQuery> {
    const loader = new GtfsLoader(new TimeParser());

    console.time("initial load");
    const [gtfs, repo] = await Promise.all([
      loader.load(fs.createReadStream(process.env.GTFS!)),
      new DatabaseTransferPatternRepository(await this.getDatabase())
    ]);
    console.timeEnd("initial load");

    return this.createQuery(gtfs, repo);
  }

  /**
   * Return a query using the in memory transfer pattern repository
   */
  public async getInMemoryQuery(): Promise<DepartAfterQuery> {
    const db = await this.getDatabaseStream();
    const repoFactory = new InMemoryTransferPatternRepositoryFactory(db);
    const loader = new GtfsLoader(new TimeParser());

    console.time("initial load");
    const [gtfs, repo] = await Promise.all([
      loader.load(fs.createReadStream(process.env.GTFS!)),
      repoFactory.create()
    ]);
    console.timeEnd("initial load");

    return this.createQuery(gtfs, repo);
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

  @memoize
  public getDatabaseStream() {
    return require("mysql2").createPool({
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

    const db2 = await this.getDatabaseStream();
    db2.end();
  }

  private createQuery(gtfs: GtfsData, repo: TransferPatternRepository) {
    const factory = new TransferPatternFactory(
      repo,
      new TimetableLegRepository(gtfs.trips),
      new TransferRepository(gtfs.transfers),
      gtfs.interchange
    );
    const planner = new TransferPatternPlanner(factory);

    console.log(`Memory usage: ${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`);

    return new DepartAfterQuery(planner, new JourneyFactory(), [new MultipleCriteriaFilter()]);
  }
}
