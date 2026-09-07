import type { StopID } from "@gb-transit/gtfs-loader";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { TransferPatternIndex, TransferPatternRepository } from "./TransferPatternRepository.js";

/**
 * Access to transfer patterns as stored in the database
 */
export class DatabaseTransferPatternRepository implements TransferPatternRepository {

  constructor(
    private readonly db: Pool
  ) {}

  /**
   * Return all the transfer patterns between the given origins and destinations
   */
  public async getPatterns(origins: StopID[], destinations: StopID[]): Promise<TransferPatternIndex> {
    // construct an index that maps the ordered origin + destination back to the original origin + destination
    const journeys: Record<string, string> = {};

    for (const origin of origins) {
      for (const destination of destinations) {
        const journeyOrdered = origin > destination ? destination + origin : origin + destination;

        journeys[journeyOrdered] = origin + destination;
      }
    }

    const [rows] = await this.db.query<PatternRow[]>(
      "SELECT * FROM transfer_patterns WHERE journey IN (?) ORDER BY LENGTH(pattern)",
      [Object.keys(journeys)]
    );

    const results: TransferPatternIndex = {};

    for (const row of rows) {
      const journey = journeys[row.journey];
      // patterns are stored with the two ends in alphabetical order, so one read the other way round
      // is the same pattern travelled in the opposite direction
      const stops = row.pattern === "" ? []
        : row.journey === journey ? row.pattern.split(",")
        : row.pattern.split(",").reverse();

      results[journey] ??= [];
      results[journey].push(stops);
    }

    return results;
  }

}

interface PatternRow extends RowDataPacket {
  pattern: string,
  journey: string
}
