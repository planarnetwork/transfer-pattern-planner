import { TransferPatternNode } from "./TransferPatternNode";
import { JourneySeed } from "./JourneySeed";
import { OriginDepartureTimes } from "./TransferPatternPlanner";
import { StopID, Time } from "../gtfs/Gtfs";
import { Transfer } from "../journey/Journey";
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
  public getJourneySeeds(originTimes: OriginDepartureTimes): JourneySeed[] {
    return this.children.flatMap(c => this.getJourneySeedsFromNode(c, originTimes[this.stop], []));
  }

  private getJourneySeedsFromNode(node: TransferPatternNode, time: Time, transfers: Transfer[]): JourneySeed[] {
    const timetableLegs = node.timetableLegs.filter(l => l.stopTimes[0].departureTime >= time);

    if (timetableLegs.length > 0) {
      return [new JourneySeed(node, transfers, timetableLegs)];
    }

    const transfer = node.findTransfer(time);

    if (node.children.length === 0 || !transfer) {
      return [];
    }

    time += transfer.duration + this.interchange[transfer.destination];

    return node.children.flatMap(n => this.getJourneySeedsFromNode(n, time, [...transfers, transfer]));
  }

}
