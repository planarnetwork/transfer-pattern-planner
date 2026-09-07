import type { StopID } from "@gb-transit/gtfs-loader";
import { CODE_WIDTH } from "./PatternFormat.js";
import type { TransferPatternIndex, TransferPatternRepository } from "./TransferPatternRepository.js";

/**
 * Loads transfer patterns from an in memory index
 */
export class InMemoryTransferPatternRepository implements TransferPatternRepository {

  constructor(
    private readonly patterns: PackedPatternIndex
  ) { }

  /**
   * Load the patterns and return them sorted by size in ascending order
   */
  public async getPatterns(origins: StopID[], destinations: StopID[]): Promise<TransferPatternIndex> {
    const result: TransferPatternIndex = {};

    for (const origin of origins) {
      for (const destination of destinations) {
        // a pattern is held once, under its two ends in alphabetical order, so a journey the other
        // way round is the same pattern read backwards
        const reversed = origin > destination;
        const packed = this.patterns.get(reversed ? destination + origin : origin + destination);

        if (packed) {
          const stops = packed.map(pattern => unpack(pattern, reversed));

          stops.sort((a, b) => a.length - b.length);
          result[origin + destination] = stops;
        }
      }
    }

    return result;
  }
}

/**
 * The patterns between two stations, keyed by those stations in alphabetical order.
 *
 * Each pattern is the stations between the two ends, packed into a single string of fixed width
 * codes rather than an array. A national feed holds tens of millions of patterns, and an array per
 * pattern costs more to keep than the stations in it do.
 */
export type PackedPatternIndex = Map<string, string[]>;

/**
 * The stations of a packed pattern, in the direction they are being travelled in.
 */
function unpack(pattern: string, reversed: boolean): StopID[] {
  const stops: StopID[] = [];

  for (let at = 0; at < pattern.length; at += CODE_WIDTH) {
    stops.push(pattern.slice(at, at + CODE_WIDTH));
  }

  return reversed ? stops.reverse() : stops;
}
