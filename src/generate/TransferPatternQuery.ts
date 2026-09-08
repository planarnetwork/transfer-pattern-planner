import { getDateNumber } from "@gb-transit/gtfs-loader";
import type { StopID } from "@gb-transit/gtfs-loader";
import { RaptorAlgorithm, checkCovered } from "raptor-journey-planner";
import type { Network } from "raptor-journey-planner";
import type { StringResults } from "./StringResults.js";

/**
 * Uses the Raptor algorithm to perform full day range queries and collect the patterns they find.
 */
export class TransferPatternQuery {
  private readonly ONE_DAY = 24 * 60 * 60;

  private readonly raptor: RaptorAlgorithm;

  constructor(
    private readonly network: Network,
    private readonly resultFactory: () => StringResults,
  ) {
    this.raptor = new RaptorAlgorithm(network.timetable);
  }

  /**
   * Scan a whole day from the origin and return the lines its patterns are written as
   */
  public plan(origin: StopID, dateObj: Date): string[] {
    const date = getDateNumber(dateObj);
    const results = this.resultFactory();

    checkCovered(this.network, date);

    const stop = this.network.stopIndex.get(origin);

    // an origin the feed has no stop for is not reachable, which is how the scan treats it too
    if (stop === undefined) {
      return results.lines();
    }

    let time = 1;

    while (time < this.ONE_DAY) {
      const [kConnections] = this.raptor.scan(new Map([[stop, time]]), date);

      time = results.add(kConnections, this.network);
    }

    return results.lines();
  }

}
