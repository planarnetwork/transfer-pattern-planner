import { StopID } from "../../gtfs/Gtfs";
import { product } from "ts-array-utils";

/**
 * Access to transfer patterns as stored in the database
 */
export class TransferPatternRepository {

  constructor(
    private readonly db: any
  ) {}

  /**
   * Return all the transfer patterns between the given origins and destinations
   */
  public async getPatterns(origins: StopID[], destinations: StopID[]): Promise<Record<string, string[][]>> {
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
      const pattern = row.journey !== journeys[row.journey] ? row.pattern.split(",").reverse() : row.pattern.split(",");

      results[journeys[row.journey]] = results[journeys[row.journey]] || [[]];
      results[journeys[row.journey]].push(pattern);
    }

    return results;
  }

}

interface PatternRow {
  pattern: string,
  journey: string
}
