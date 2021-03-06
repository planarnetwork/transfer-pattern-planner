import { TransferPatternFactory } from "./TransferPatternFactory";
import { TransferPattern } from "./TransferPattern";
import { DateNumber, DayOfWeek, StopID, Time } from "../gtfs/Gtfs";
import { AnyLeg } from "../journey/Journey";

/**
 * Use the transfer pattern factory to create a number of transfer patterns that return journeys
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

    return patterns.flatMap(pattern => pattern.getJourneys(originTimes));
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
