import { Duration, StopID, Time, TimetableLeg, Transfer } from "..";
import { AnyLeg } from "../journey/Journey";
import { JourneyLegs } from "./TransferPatternPlanner";

export class TransferPatternNode {

  private timetableLegIndex: number = 0;
  private transferIndex: number = 0;

  constructor(
    private readonly timetableLegs: TimetableLeg[],
    private readonly transfers: Transfer[],
    private readonly children: TransferPatternNode[],
    private readonly interchange: Duration
  ) {}

  public getJourneys(legs: AnyLeg[], departureTime: Time): JourneyLegs[] {
    const leg = this.findLeg(departureTime);

    if (!leg) {
      return [];
    }

    if (this.children.length === 0) {
      return [[...legs, leg]];
    }

    const arrivalTime = isTransfer(leg)
      ? departureTime + leg.duration
      : leg.callingPoints[leg.callingPoints.length - 1].arrivalTime;

    return this.children.flatMap(p => p.getJourneys([...legs, leg], arrivalTime + this.interchange));
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

  private findTransfer(departureTime: Time): Transfer | null {
    for (; this.transferIndex < this.transfers.length; this.transferIndex++) {
      const leg = this.transfers[this.transferIndex];

      if (leg.startTime >= departureTime) {
        return leg;
      }
    }

    return null;
  }
}
