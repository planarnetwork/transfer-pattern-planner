import { StopID } from "../../gtfs/Gtfs";

export class TransferPatternRepository {

  constructor(
    private readonly db: any
  ) {}

  // todo accept a group of origins and destinations
  // make sure to add direct pattern between every origin and destination
  public async getPatterns(origin: StopID, destination: StopID): Promise<string[][]> {
    const isReversed = origin > destination;
    const [rows]: [PatternRow[]] = await this.db.query(
      "SELECT pattern FROM transfer_patterns WHERE journey = ? ORDER BY LENGTH(pattern), pattern",
      [isReversed ? destination + origin : origin + destination]
    );

    const results: string[][] = [[]];

    for (const row of rows) {
      results.push(isReversed ? row.pattern.split(",").reverse() : row.pattern.split(","));
    }

    return results;
  }
}

interface PatternRow {
  pattern: string
}
