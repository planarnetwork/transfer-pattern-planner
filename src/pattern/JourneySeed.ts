import { TransferPatternNode } from "./TransferPatternNode";
import { JourneyLegs } from "./TransferPatternPlanner";
import { TimetableLeg, Transfer } from "../journey/Journey";

/**
 * A JourneySeed is the beginning of a series of timetable results. It contains the initial legs required to get to the
 * first timetable legs in a transfer pattern.
 */
export class JourneySeed {

  constructor(
    private readonly node: TransferPatternNode,
    private readonly transfers: Transfer[],
    private readonly timetableLegs: TimetableLeg[]
  ) {}

  /**
   * Try to create a journey for every timetable leg in this seed.
   */
  public getJourneys(): JourneyLegs[] {
    return this.timetableLegs.flatMap(l => this.node.getJourneys(
      this.transfers,
      l.stopTimes[0].departureTime,
    ));
  }
}