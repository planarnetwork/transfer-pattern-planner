import type { Duration, Time } from "@gb-transit/gtfs-loader";
import { type AnyLeg, isTransfer, type TimetableLeg, type Transfer } from "../journey/Journey.js";
import type { JourneyLegs } from "./TransferPatternPlanner.js";

/**
 * One stop allow a transfer patterns path.
 */
export class TransferPatternNode {

  private timetableLegIndex: number = 0;

  constructor(
    public readonly timetableLegs: TimetableLeg[],
    private readonly transfers: Transfer[],
    public children: TransferPatternNode[],
    /** the time it takes to change at the station this node is, added on arriving here */
    public readonly interchange: Duration
  ) {}

  /**
   * Using the existing legs find the next available leg that arrives at this node. Continue creating journeys for each
   * child node until there are none left and the pattern is complete.
   *
   * If a leg cannot be found return an empty array, nullifying the journey so far.
   */
  public getJourneys(legs: AnyLeg[], departureTime: Time): JourneyLegs[] {
    const leg = this.findLeg(departureTime);

    if (!leg) {
      return [];
    }

    if (this.children.length === 0) {
      return [[...legs, leg]];
    }

    const arrivalTime = isTransfer(leg)
      ? departureTime + leg.duration + this.interchange
      : leg.stopTimes[leg.stopTimes.length - 1].arrivalTime + this.interchange;

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

  /**
   * Unlike the timetable legs the footpaths are not in time order and a window that has not opened yet will open at a
   * later time, so there is no cursor to move: the list, which is short, is scanned in full every time.
   */
  public findTransfer(departureTime: Time): Transfer | null {
    return this.transfers.find(t => t.startTime <= departureTime && t.endTime >= departureTime) ?? null;
  }
}
