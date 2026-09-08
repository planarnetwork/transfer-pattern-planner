import type { Duration, Time } from "@gb-transit/gtfs-loader";
import type { TimetableLeg, Transfer } from "../journey/Journey.js";
import type { StopIdx } from "../gtfs/StopTable.js";
import type { TransferPatternNode } from "./TransferPatternNode.js";
import type { JourneyLegs, OriginDepartureTimes } from "./TransferPatternPlanner.js";

/**
 * The root of a series of TransferPatternNodes. Represents an abstract path between two stops.
 *
 * A pattern flattened back out of the TransferTreeRepository, for one query. TransferPath would say it
 * better.
 */
export class TransferPattern {

  constructor(
    private readonly stop: StopIdx,
    private readonly children: TransferPatternNode[]
  ) {}

  /**
   * Return a journey seed for every child
   */
  public getJourneys(originTimes: OriginDepartureTimes): JourneyLegs[] {
    const time = originTimes.get(this.stop) as Time;

    return this.children.flatMap(n => this.getJourneysFromNode(n, time, []));
  }

  private getJourneysFromNode(node: TransferPatternNode, time: Time, transfers: Transfer[]): JourneyLegs[] {
    // todo perf test: is this filter needed
    const timetableLegs = node.timetableLegs.filter(l => l.stopTimes[0].departureTime >= time);

    if (timetableLegs.length > 0) {
      return node.children.length === 0
        ? timetableLegs.map(l => [...transfers, l])
        : node.children.flatMap(
          childNode => this.getJourneysFromChildNode(childNode, transfers, timetableLegs, node.interchange)
        );
    }

    const transfer = node.findTransfer(time);

    if (node.children.length === 0 || !transfer) {
      return [];
    }

    // every leg of a node arrives at the station the node is, so the interchange added on arriving
    // is the node's own rather than one looked up by where the leg ended
    time += transfer.duration + node.interchange;

    return node.children.flatMap(n => this.getJourneysFromNode(n, time, [...transfers, transfer]));
  }

  private getJourneysFromChildNode(
    childNode: TransferPatternNode,
    transfers: Transfer[],
    timetableLegs: TimetableLeg[],
    interchange: Duration
  ): JourneyLegs[] {
    return timetableLegs.flatMap(l => childNode.getJourneys(
      [...transfers, l],
      l.stopTimes[l.stopTimes.length - 1].arrivalTime + interchange
    ));
  }
}
