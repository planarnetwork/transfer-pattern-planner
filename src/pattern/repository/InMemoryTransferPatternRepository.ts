import type { StopID } from "@gb-transit/gtfs-loader";
import type { Pool } from "mysql2";
import type { TransferPatternIndex, TransferPatternRepository } from "./TransferPatternRepository.js";

/**
 * Loads transfer patterns from an in memory index
 */
export class InMemoryTransferPatternRepository implements TransferPatternRepository {

  constructor(
    private readonly patterns: Record<StopID, Record<StopID, string[]>>
  ) { }

  /**
   * Load the patterns and return them sorted by size in ascending order
   */
  public async getPatterns(origins: StopID[], destinations: StopID[]): Promise<TransferPatternIndex> {
    const result: TransferPatternIndex = {};

    for (const origin of origins) {
      for (const destination of destinations) {
        const reversed = origin > destination;
        const patterns = reversed ? this.patterns[destination]?.[origin] : this.patterns[origin]?.[destination];

        if (patterns) {
          const stops = patterns.map(p => p === "" ? [] : reversed ? p.split(",").reverse() : p.split(","));

          stops.sort((a, b) => a.length - b.length);
          result[origin + destination] = stops;
        }
      }
    }

    return result;
  }
}

/**
 * Factory that will create the in-memory transfer pattern index by loading them from a database
 */
export class InMemoryTransferPatternRepositoryFactory {

  constructor(
    private readonly db: Pool
  ) {}

  public create(): Promise<InMemoryTransferPatternRepository> {
    return new Promise((resolve, reject) => {
      const stream = this.db.query("SELECT * FROM transfer_patterns");
      const index: Record<StopID, Record<StopID, string[]>> = {};

      stream.on("result", (row: PatternRow) => {
        const origin = row.journey.slice(0, 3);
        const destination = row.journey.slice(3, 6);
        const [a, b] = origin > destination ? [destination, origin] : [origin, destination];

        index[a] ??= {};
        index[a][b] ??= [];
        index[a][b].push(row.pattern);
      });

      stream.on("error", reject);
      stream.on("end", () => resolve(new InMemoryTransferPatternRepository(index)));
    });
  }

}

interface PatternRow {
  pattern: string,
  journey: string
}
