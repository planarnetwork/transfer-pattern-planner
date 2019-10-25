import { TransferPatternFactory } from "./TransferPatternFactory";
import { TransferPattern } from "./TransferPattern";
import { DateNumber, DayOfWeek, StopID, Time } from "../gtfs/Gtfs";
import { AnyLeg } from "../journey/Journey";

/**
 * Get a list of journeys departing
 */
export class TransferPatternPlanner {

  constructor(
    private readonly transferPatternRepository: TransferPatternFactory,
  ) {}

  public async plan(
    originTimes: OriginDepartureTimes,
    destinations: StopID[],
    date: DateNumber,
    dow: DayOfWeek
  ): Promise<JourneyLegs[]> {
    const origins = Object.keys(originTimes);
    const patterns = await this.transferPatternRepository.getTransferPatterns(origins, destinations, date, dow);

    return patterns.flatMap(pattern => this.getJourneyLegsFromPattern(pattern, originTimes));
  }

  private getJourneyLegsFromPattern(pattern: TransferPattern, originTimes: OriginDepartureTimes): JourneyLegs[] {
    return pattern
      .getJourneySeeds(originTimes)
      .flatMap(seed => seed.getJourneys());
  }

}

/**
 * Journey as represented by an array of legs
 */
export type JourneyLegs = AnyLeg[];

/**
 * Departure time for each origin
 */
export type OriginDepartureTimes = Record<StopID, Time>;
