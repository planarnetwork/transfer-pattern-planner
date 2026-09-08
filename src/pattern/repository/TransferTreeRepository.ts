import type { StopIdx } from "../../gtfs/StopTable.js";
import { NO_NODE } from "./TransferTreeNodes.js";
import type { StationTransferTree } from "./StationTransferTree.js";
import type { TransferPatternRepository } from "./TransferPatternRepository.js";

/**
 * Every pattern in a file, holding each stop it shares with another pattern once. A national feed's
 * 34 million patterns are 187 million stops laid out flat, and 37 million once shared.
 *
 * Nothing walks down it, only up, so a node is its stop and the node before it. A pattern is the
 * node its last stop sits at, and reading one back is climbing to the root.
 */
export class TransferTreeRepository implements TransferPatternRepository {

  constructor(
    /** the stop at each node */
    private readonly stop: Uint16Array,
    /** the node before it, NO_NODE at a first stop */
    private readonly parent: Int32Array,
    /** for each origin, the patterns from it by where they end */
    private readonly from: (StationTransferTree | undefined)[]
  ) {}

  /** How many nodes it holds, which is what sharing the stations of a pattern buys */
  public get nodes(): number {
    return this.stop.length;
  }

  /** The stations between the two ends, shortest first. The ends are what was asked for */
  public getPatterns(origin: StopIdx, destination: StopIdx): StopIdx[][] {
    // a pattern is held once for both directions, so it hangs off whichever of its two ends the
    // file wrote first, and a journey the other way round is the same pattern read backwards
    const ends = this.from[origin]?.endsAt(destination) ?? this.from[destination]?.endsAt(origin);

    if (ends === undefined) {
      return [];
    }

    const patterns: StopIdx[][] = [];

    for (const end of ends) {
      patterns.push(this.stopsOf(end, origin));
    }

    patterns.sort((a, b) => a.length - b.length);

    return patterns;
  }

  private stopsOf(end: number, origin: StopIdx): StopIdx[] {
    const stops: StopIdx[] = [];

    // climbing runs last stop first, which is the order travelled in when the end it hangs from is
    // the destination rather than the origin
    for (let node = end; node !== NO_NODE; node = this.parent[node]) {
      stops.push(this.stop[node]);
    }

    return (this.stop[end] === origin ? stops : stops.reverse()).slice(1, -1);
  }

}
