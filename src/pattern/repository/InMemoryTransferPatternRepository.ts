import { StopID } from "../../gtfs/Gtfs";
import { product, pushNested } from "ts-array-utils";
import { TransferPatternRepository } from "./TransferPatternRepository";

/**
 * Loads transfer patterns from an in memory index
 */
export class InMemoryTransferPatternRepository implements TransferPatternRepository {

  constructor(
    private readonly patterns: Record<string, Record<string, string[]>>
  ) { }

  /**
   * Load the patterns and return them sorted by size in ascending order
   */
  public async getPatterns(origins: StopID[], destinations: StopID[]): Promise<Record<string, string[][]>> {
    const result = {};

    for (const [origin, destination] of product(origins, destinations)) {
      const patterns = origin > destination ? this.patterns[destination][origin] : this.patterns[origin][destination];

      if (patterns) {
        result[origin + destination] = origin > destination
          ? patterns.map(p => p === "" ? [] : p.split(",").reverse())
          : patterns.map(p => p === "" ? [] : p.split(","));

        result[origin + destination].sort((a, b) => a.length - b.length);
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
    private readonly db: any
  ) {}

  public async create(): Promise<InMemoryTransferPatternRepository> {
    return new Promise(resolve => {
      const stream = this.db.query("SELECT * FROM transfer_patterns");
      const index = {};

      stream.on("result", row => {
        const origin = row.journey.substr(0, 3);
        const destination = row.journey.substr(3, 3);
        const [a , b] = origin > destination ? [destination, origin] : [origin, destination];

        pushNested(row.pattern, index, a, b);
      });

      stream.on("end", () => resolve(new InMemoryTransferPatternRepository(index)));
    });
  }

}