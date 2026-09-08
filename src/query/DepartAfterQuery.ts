import type { DayOfWeek, StopID, Time } from "@gb-transit/gtfs-loader";
import type { Journey } from "../journey/Journey.js";
import type { JourneyFactory } from "../journey/JourneyFactory.js";
import type { OriginDepartureTimes, TransferPatternPlanner } from "../pattern/TransferPatternPlanner.js";
import { type StopIdx, type StopTable, stopIdxOf, UNKNOWN_STOP } from "../StopTable.js";
import type { JourneyFilter } from "./JourneyFilter.js";

/**
 * Search for journeys between a set of origin and destinations departing after a given time.
 */
export class DepartAfterQuery {

  constructor(
    private readonly planner: TransferPatternPlanner,
    private readonly resultsFactory: JourneyFactory,
    private readonly stops: StopTable,
    private readonly filters: JourneyFilter[] = []
  ) { }

  /**
   * Plan a journey between the origin and destination set of stops on the given date and time
   */
  public plan(origins: StopID[], destinations: StopID[], date: Date, time: Time): Journey[] {
    // the planner works in stop indexes, the query in the codes the caller knows
    const originTimes: OriginDepartureTimes = new Map(
      this.toStopIndexes(origins).map(stop => [stop, time])
    );

    const dateNumber = this.getDateNumber(date);
    const dayOfWeek = date.getDay() as DayOfWeek;
    const journeyLegs = this.planner.plan(originTimes, this.toStopIndexes(destinations), dateNumber, dayOfWeek);
    const journeys = journeyLegs.map(legs => this.resultsFactory.getJourney(legs));

    // apply each filter to the results
    return this.filters.reduce((rs, filter) => filter.apply(rs), journeys);
  }

  /**
   * A station neither the feed nor the patterns names is one nothing runs to or from, so it is left
   * out rather than planned for
   */
  private toStopIndexes(stops: StopID[]): StopIdx[] {
    return stops
      .map(stop => stopIdxOf(this.stops, stop))
      .filter(stop => stop !== UNKNOWN_STOP);
  }

  private getDateNumber(date: Date): number {
    const str = date.toISOString();

    return parseInt(str.slice(0, 4) + str.slice(5, 7) + str.slice(8, 10), 10);
  }

}
