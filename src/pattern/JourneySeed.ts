import { TransferPatternNode } from "./TransferPatternNode";
import { TimetableLeg, Transfer } from "..";
import { JourneyLegs } from "./TransferPatternPlanner";

export class JourneySeed {

  constructor(
    private readonly node: TransferPatternNode,
    private readonly transfers: Transfer[],
    private readonly timetableLegs: TimetableLeg[]
  ) {}

  public getJourneys(): JourneyLegs[] {
    return this.timetableLegs.flatMap(l => this.node.getJourneys(
      [...this.transfers, l],
      l.stopTimes[l.stopTimes.length - 1].arrivalTime,
    ));
  }
}