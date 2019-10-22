import { AnyLeg, DayOfWeek, Journey, JourneyFactory, StopID, Time } from "../index";
import { TransferPatternFactory } from "./TransferPatternFactory";
import { TransferPattern } from "./TransferPattern";

/**
 * Get a list of journeys departing
 */
export class TransferPatternPlanner {

  constructor(
    private readonly transferPatternRepository: TransferPatternFactory,
  ) {}

  public plan(originTimes: OriginDepartureTimes, destinations: StopID[], date: number, dow: DayOfWeek): JourneyLegs[] {
    const origins = Object.keys(originTimes);

    return this.transferPatternRepository
      .getTransferPatterns(origins, destinations, date, dow)
      .flatMap(pattern => this.getJourneyLegsFromPattern(pattern, originTimes));
  }

  private getJourneyLegsFromPattern(pattern: TransferPattern, originTimes: OriginDepartureTimes): JourneyLegs[] {
    return pattern
      .getJourneySeeds(originTimes)
      .flatMap(seed => seed.getJourneys());
  }

}

export type JourneyLegs = AnyLeg[];

/**
 * Departure time for each origin
 */
export type OriginDepartureTimes = Record<StopID, Time>;
