import * as fs from "node:fs";
import type { Pool } from "mysql2";
import type { Pool as PromisePool } from "mysql2/promise";
import { type GtfsData, loadGtfs } from "./gtfs/GtfsLoader.js";
import { JourneyFactory } from "./journey/JourneyFactory.js";
import { DatabaseTransferPatternRepository } from "./pattern/repository/DatabaseTransferPatternRepository.js";
import { InMemoryTransferPatternRepositoryFactory } from "./pattern/repository/InMemoryTransferPatternRepository.js";
import { TimetableLegRepository } from "./pattern/repository/TimetableLegRepository.js";
import type { TransferPatternRepository } from "./pattern/repository/TransferPatternRepository.js";
import { TransferRepository } from "./pattern/repository/TransferRepository.js";
import { TransferPatternFactory } from "./pattern/TransferPatternFactory.js";
import { TransferPatternPlanner } from "./pattern/TransferPatternPlanner.js";
import { DepartAfterQuery } from "./query/DepartAfterQuery.js";
import { MultipleCriteriaFilter } from "./query/MultipleCriteriaFilter.js";

/**
 * Dependency container
 */
export class Container {

  private database?: Promise<PromisePool>;
  private databaseStream?: Promise<Pool>;

  public async getQuery(): Promise<DepartAfterQuery> {
    console.time("initial load");
    const [gtfs, repo] = await Promise.all([
      loadGtfs(fs.createReadStream(process.env.GTFS!)),
      this.getDatabase().then(db => new DatabaseTransferPatternRepository(db))
    ]);
    console.timeEnd("initial load");

    return this.createQuery(gtfs, repo);
  }

  /**
   * Return a query using the in memory transfer pattern repository
   */
  public async getInMemoryQuery(): Promise<DepartAfterQuery> {
    console.time("initial load");
    const [gtfs, repo] = await Promise.all([
      loadGtfs(fs.createReadStream(process.env.GTFS!)),
      this.getDatabaseStream().then(db => new InMemoryTransferPatternRepositoryFactory(db).create())
    ]);
    console.timeEnd("initial load");

    return this.createQuery(gtfs, repo);
  }

  public getDatabase(): Promise<PromisePool> {
    this.database ??= import("mysql2/promise").then(mysql => mysql.createPool(this.getDatabaseConfig()));

    return this.database;
  }

  public getDatabaseStream(): Promise<Pool> {
    this.databaseStream ??= import("mysql2").then(mysql => mysql.createPool(this.getDatabaseConfig()));

    return this.databaseStream;
  }

  public async end(): Promise<void> {
    if (this.database) {
      await (await this.database).end();
    }

    if (this.databaseStream) {
      (await this.databaseStream).end();
    }
  }

  private getDatabaseConfig() {
    return {
      host: process.env.DATABASE_HOST || "localhost",
      user: process.env.DATABASE_USER || "root",
      database: process.env.DATABASE_NAME || "ojp",
      password: process.env.DATABASE_PASS || undefined,
      dateStrings: true,
      connectionLimit: 2
    };
  }

  private createQuery(gtfs: GtfsData, repo: TransferPatternRepository): DepartAfterQuery {
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
