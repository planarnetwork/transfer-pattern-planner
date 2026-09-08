import type { StopID } from "@gb-transit/gtfs-loader";
import { type PatternTree, patternsBetween } from "./PatternTree.js";
import type { TransferPatternIndex, TransferPatternRepository } from "./TransferPatternRepository.js";

/**
 * Loads transfer patterns from a tree held in memory.
 *
 * This is where the station codes a query asks in are exchanged for the stop indexes the tree works
 * in, and where the stops of a pattern are named again on the way back out.
 */
export class InMemoryTransferPatternRepository implements TransferPatternRepository {

  constructor(
    private readonly patterns: PatternTree
  ) { }

  /**
   * Load the patterns and return them sorted by size in ascending order
   */
  public async getPatterns(origins: StopID[], destinations: StopID[]): Promise<TransferPatternIndex> {
    const result: TransferPatternIndex = {};

    for (const origin of origins) {
      // a station the file holds no pattern for is one there is no journey through, which is how
      // a pair with no patterns between them is treated too
      const from = this.patterns.stopIndex.get(origin);

      if (from === undefined) {
        continue;
      }

      for (const destination of destinations) {
        const to = this.patterns.stopIndex.get(destination);

        if (to === undefined) {
          continue;
        }

        const stops = patternsBetween(this.patterns, from, to);

        if (stops.length > 0) {
          result[origin + destination] = stops;
        }
      }
    }

    return result;
  }
}
