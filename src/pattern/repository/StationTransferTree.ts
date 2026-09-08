import type { StopIdx } from "../../gtfs/StopTable.js";

const NOT_FOUND = -1;

/**
 * The patterns leaving one station, by where they end. A trie, strictly: the sharing is on the
 * stations a pattern begins with, never the ones it ends with.
 *
 * A national feed runs patterns between nearly four million pairs, so a list per pair is four
 * million objects holding thirty four million numbers - more memory in the holding than in what is
 * held. Everything one origin knows goes into a single array instead:
 *
 *     [ count, destination..., offset..., end node... ]
 *
 * `count` destinations in order, then `count + 1` offsets into the end nodes that follow, one per
 * destination and a last saying where they finish.
 */
export class StationTransferTree {

  private readonly data: Int32Array;

  /** The destinations are put in order so they can be searched */
  constructor(patterns: Map<StopIdx, number[]>) {
    const destinations = [...patterns.keys()].sort((a, b) => a - b);
    const count = destinations.length;
    const nodes = destinations.map(destination => patterns.get(destination) as number[]);
    const total = nodes.reduce((sum, ending) => sum + ending.length, 0);

    const data = new Int32Array(2 + count * 2 + total);
    const ends = 2 + count * 2;

    data[0] = count;

    let at = 0;

    for (let i = 0; i < count; i++) {
      data[1 + i] = destinations[i];
      data[1 + count + i] = at;
      data.set(nodes[i], ends + at);
      at += nodes[i].length;
    }

    data[1 + count * 2] = at;

    this.data = data;
  }

  /**
   * The node each pattern to this destination ends on, as a window onto the packed array rather
   * than a copy of it.
   */
  public endsAt(destination: StopIdx): Int32Array | undefined {
    const count = this.data[0];
    const found = this.search(destination, count);

    if (found === NOT_FOUND) {
      return undefined;
    }

    const ends = 2 + count * 2;

    return this.data.subarray(ends + this.data[1 + count + found], ends + this.data[2 + count + found]);
  }

  /** In order, so this halves the search rather than walking what a busy origin reaches */
  private search(destination: StopIdx, count: number): number {
    let low = 0;
    let high = count;

    while (low < high) {
      const middle = (low + high) >>> 1;

      if (this.data[1 + middle] < destination) {
        low = middle + 1;
      }
      else {
        high = middle;
      }
    }

    return low < count && this.data[1 + low] === destination ? low : NOT_FOUND;
  }

}
