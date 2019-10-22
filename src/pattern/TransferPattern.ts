import { StopID, Time, Transfer } from "..";
import { TransferPatternNode } from "./TransferPatternNode";
import { JourneySeed } from "./JourneySeed";
import { OriginDepartureTimes } from "./TransferPatternPlanner";

export class TransferPattern {

  constructor(
    private readonly stop: StopID,
    private readonly children: TransferPatternNode[]
  ) {}

  public getJourneySeeds(originTimes: OriginDepartureTimes): JourneySeed[] {
    return this.children.flatMap(c => this.getJourneySeedsFromNode(c, originTimes[this.stop], []));
  }

  private getJourneySeedsFromNode(node: TransferPatternNode, time: Time, transfers: Transfer[]): JourneySeed[] {
    const timetableLegs = node.timetableLegs.filter(l => l.stopTimes[0].departureTime > time); //pickup check elsewhere?

    if (timetableLegs.length > 0) {
      return [new JourneySeed(node, transfers, timetableLegs)];
    }

    const transfer = node.fixedLegs[0];

    if (node.children.length === 0 || !transfer) {
      return [];
    }

    time += transfer.duration + this.interchange[transfer.destination];

    return node.children.flatMap(n => this.getJourneySeedsFromNode(n, time, [...transfers, transfer]));
  }

}
