import { StopID } from "../../gtfs/Gtfs";
import { product, pushNested } from "ts-array-utils";
import { TransferPatternRepository, TransferPatternIndex } from "./TransferPatternRepository";

/**
 * Access to transfer patterns as stored in the database
 */
export class DatabaseTransferPatternRepository implements TransferPatternRepository {

  constructor(
    private readonly db: any
  ) {}

  /**
   * Return all the transfer patterns between the given origins and destinations
   */
  public async getPatterns(origins: StopID[], destinations: StopID[]): Promise<TransferPatternIndex> {
    // construct an index that makes the ordered origin + destination back to the original origin + destination
    const journeys: Record<string, string> = product(origins, destinations)
      .reduce((index, [origin, destination]) => {
        const journeyOrdered = origin > destination ? destination + origin : origin + destination;
        index[journeyOrdered] = origin + destination;

        return index;
      }, {});

    const [rows]: [PatternRow[]] = await this.db.query(
      "SELECT * FROM transfer_patterns WHERE journey IN (?) ORDER BY LENGTH(pattern)",
      [Object.keys(journeys)]
    );

    const results = {};

    for (const row of rows) {
      if (row.pattern === "") {
        pushNested([], results, journeys[row.journey]);
      }
      else {
        const stops = row.journey !== journeys[row.journey] ? row.pattern.split(",").reverse() : row.pattern.split(",");

        pushNested(stops, results, journeys[row.journey]);
      }
    }

    return results;
  }

}

interface PatternRow {
  pattern: string,
  journey: string
}
