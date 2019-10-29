import { StopID } from "../..";
import { product, pushNested } from "ts-array-utils";

export class LocalTransferPatternRepository {

  constructor(
    private readonly index: TransferPatternIndex
  ) {
  }

  public async getPatterns(origins: StopID[], destinations: StopID[]): Promise<Record<string, string[][]>> {
    const results = {};

    for (const [origin, destination] of product(origins, destinations)) {
      results[origin + destination] = origin > destination
        ? this.index[destination][origin].map(p => p.reverse())
        : this.index[origin][destination];
    }

    return results;
  }

  public static async create(db: any): Promise<TransferPatternIndex> {
    const results = db.query("SELECT * FROM transfer_patterns");

    return new Promise<TransferPatternIndex>((resolve, reject) => {
      const index = {};
      results.on("result", (row: PatternRow) => {
        const origin = row.journey.substring(0, 3);
        const destination = row.journey.substring(3);

        index[origin] = index[origin] || {};
        index[origin][destination] = index[origin][destination] || [[]];
        index[origin][destination].push(row.pattern.split(","));
      });

      results.on("end", () => {
        resolve(index);
      });
      results.on("error", reject);
    });
  }
}

export type TransferPatternIndex = Record<StopID, Record<StopID, string[][]>>;

interface PatternRow {
  pattern: string,
  journey: string
}
