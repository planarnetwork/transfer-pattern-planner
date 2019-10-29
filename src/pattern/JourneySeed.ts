import { TransferPatternNode } from "./TransferPatternNode";
import { JourneyLegs } from "./TransferPatternPlanner";
import { TimetableLeg, Transfer } from "../journey/Journey";
import { Duration } from "../gtfs/Gtfs";

/**
 * A JourneySeed is the beginning of a series of timetable results. It contains the initial legs required to get to the
 * first timetable legs in a transfer pattern.
 */
export class JourneySeed {

  constructor(
    private readonly node: TransferPatternNode,
    private readonly transfers: Transfer[],
    private readonly timetableLegs: TimetableLeg[],
    private readonly interchange: Duration
  ) {}

  /**
   * If this node has no children then just return the timetable legs prepended with the transfers.
   *
   * Otherwise, pass every timetable leg with the transfers prepended to every child node to complete the journey.
   */
  public getJourneys(): JourneyLegs[] {
    return this.node.children.length === 0
        ? this.timetableLegs.map(l => [...this.transfers, l])
        : this.node.children.flatMap(n => this.getJourneysFromNode(n));
  }

  private getJourneysFromNode(node: TransferPatternNode): JourneyLegs[] {
    return this.timetableLegs.flatMap(l => node.getJourneys(
        [...this.transfers, l],
        l.stopTimes[l.stopTimes.length - 1].arrivalTime + this.interchange
    ));
  }

}
