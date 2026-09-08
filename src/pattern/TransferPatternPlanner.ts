import type { DateNumber, DayOfWeek, Time } from "@gb-transit/gtfs-loader";
import type { AnyLeg } from "../journey/Journey.js";
import type { StopIdx } from "../gtfs/StopTable.js";
import type { TransferPatternFactory } from "./TransferPatternFactory.js";

/**
 * Use the transfer pattern factory to create a number of transfer patterns that return journeys
 */
export class TransferPatternPlanner {

  constructor(
    private readonly transferPatternRepository: TransferPatternFactory,
  ) {}

  public plan(
    originTimes: OriginDepartureTimes,
    destinations: StopIdx[],
    date: DateNumber,
    dow: DayOfWeek
  ): JourneyLegs[] {
    const origins = [...originTimes.keys()];
    const patterns = this.transferPatternRepository.getTransferPatterns(origins, destinations, date, dow);

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
export type OriginDepartureTimes = Map<StopIdx, Time>;
