import { AnyLeg, isTransfer, TimetableLeg, Transfer } from "../journey/Journey";
import { JourneyLegs } from "./TransferPatternPlanner";
import { Duration, Time } from "../gtfs/Gtfs";

/**
 * One stop allow a transfer patterns path.
 */
export class TransferPatternNode {

  private timetableLegIndex: number = 0;
  private transferIndex: number = 0;

  constructor(
    public readonly timetableLegs: TimetableLeg[],
    private readonly transfers: Transfer[],
    public children: TransferPatternNode[],
    private readonly interchange: Duration
  ) {}

  /**
   * Using the existing legs find the next available leg that arrives at this node. Continue creating journeys for each
   * child node until there are none left and the pattern is complete.
   *
   * If a leg cannot be found return an empty array, nullifying the journey so far.
   */
  public getJourneys(legs: AnyLeg[], previousArrivalTime: Time): JourneyLegs[] {
    const departureTime = previousArrivalTime + this.interchange;
    const leg = this.findLeg(departureTime);

    if (!leg) {
      return [];
    }

    if (this.children.length === 0) {
      return [[...legs, leg]];
    }

    const arrivalTime = isTransfer(leg)
      ? departureTime + leg.duration
      : leg.stopTimes[leg.stopTimes.length - 1].arrivalTime;

    return this.children.flatMap(p => p.getJourneys([...legs, leg], arrivalTime));
  }

  private findLeg(departureTime: Time): AnyLeg | null {
    return this.findTimetableLeg(departureTime) || this.findTransfer(departureTime);
  }

  private findTimetableLeg(departureTime: Time): TimetableLeg | null {
    for (; this.timetableLegIndex < this.timetableLegs.length; this.timetableLegIndex++) {
      const leg = this.timetableLegs[this.timetableLegIndex];

      if (leg.stopTimes[0].departureTime >= departureTime) {
        return leg;
      }
    }

    return null;
  }

  public findTransfer(departureTime: Time): Transfer | null {
    for (; this.transferIndex < this.transfers.length; this.transferIndex++) {
      const leg = this.transfers[this.transferIndex];

      if (leg.startTime <= departureTime && leg.endTime >= departureTime) {
        return leg;
      }
    }

    return null;
  }
}
