import { TransferPatternNode } from "./TransferPatternNode";
import { JourneyLegs, OriginDepartureTimes } from "./TransferPatternPlanner";
import { StopID, Time } from "../gtfs/Gtfs";
import { TimetableLeg, Transfer } from "../journey/Journey";
import { Interchange } from "../gtfs/GtfsLoader";

/**
 * The root of a series of TransferPatternNodes. Represents an abstract path between to stops.
 */
export class TransferPattern {

  constructor(
    private readonly stop: StopID,
    private readonly children: TransferPatternNode[],
    private readonly interchange: Interchange
  ) {}

  /**
   * Return a journey seed for every child
   */
  public getJourneys(originTimes: OriginDepartureTimes): JourneyLegs[] {
    return this.children.flatMap(n => this.getJourneysFromNode(n, originTimes[this.stop], []));
  }

  private getJourneysFromNode(node: TransferPatternNode, time: Time, transfers: Transfer[]): JourneyLegs[] {
    // todo perf test: is this filter needed
    const timetableLegs = node.timetableLegs.filter(l => l.stopTimes[0].departureTime >= time);

    if (timetableLegs.length > 0) {
      return node.children.length === 0
        ? timetableLegs.map(l => [...transfers, l])
        : node.children.flatMap(childNode => this.getJourneysFromChildNode(childNode, transfers, timetableLegs));
    }

    const transfer = node.findTransfer(time);

    if (node.children.length === 0 || !transfer) {
      return [];
    }

    time += transfer.duration + this.interchange[transfer.destination];

    return node.children.flatMap(n => this.getJourneysFromNode(n, time, [...transfers, transfer]));
  }

  private getJourneysFromChildNode(
    childNode: TransferPatternNode,
    transfers: Transfer[],
    timetableLegs: TimetableLeg[]
  ): JourneyLegs[] {
    const interchange = this.interchange[timetableLegs[0].destination];

    return timetableLegs.flatMap(l => childNode.getJourneys(
      [...transfers, l],
      l.stopTimes[l.stopTimes.length - 1].arrivalTime + interchange
    ));
  }
}
