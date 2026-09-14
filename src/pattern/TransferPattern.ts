import type { Duration, Time } from "@gb-transit/gtfs-loader";
import type { TimetableLeg, Transfer } from "../journey/Journey.js";
import type { StopIdx } from "../gtfs/StopTable.js";
import { arrivalOf, type TransferPatternNode } from "./TransferPatternNode.js";
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

  /**
   * Every timetable leg from here is a journey of its own, since the origin can be left at any time
   * after the query's. A footpath is only walked at the time given, so it is a journey where it
   * reaches the next station before any of those legs do. It is followed first, since the child
   * nodes are asked for legs in the order they are reached.
   */
  private getJourneysFromNode(node: TransferPatternNode, time: Time, transfers: Transfer[]): JourneyLegs[] {
    // todo perf test: is this filter needed
    const timetableLegs = node.timetableLegs.filter(l => l.stopTimes[0].departureTime >= time);
    const transfer = node.children.length === 0 ? null : node.findTransfer(time);
    const walked = transfer !== null && (timetableLegs.length === 0 || time + transfer.duration < arrivalOf(timetableLegs[0]))
      ? this.getJourneysAfterTransfer(node, time, transfers, transfer)
      : [];

    if (timetableLegs.length === 0) {
      return walked;
    }

    const ridden = node.children.length === 0
      ? timetableLegs.map(l => [...transfers, l])
      : node.children.flatMap(
        childNode => this.getJourneysFromChildNode(childNode, transfers, timetableLegs, node.interchange)
      );

    return walked.length === 0 ? ridden : [...walked, ...ridden];
  }

  private getJourneysAfterTransfer(
    node: TransferPatternNode,
    time: Time,
    transfers: Transfer[],
    transfer: Transfer
  ): JourneyLegs[] {
    // every leg of a node arrives at the station the node is, so the interchange added on arriving
    // is the node's own rather than one looked up by where the leg ended
    const arrival = time + transfer.duration + node.interchange;

    return node.children.flatMap(n => this.getJourneysFromNode(n, arrival, [...transfers, transfer]));
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
