import type { DayOfWeek, StopID, Time } from "@gb-transit/gtfs-loader";
import type { GtfsData } from "../gtfs/GtfsLoader.js";
import { type StopIdx, type StopTable, UNKNOWN_STOP } from "../gtfs/StopTable.js";
import type { Journey } from "../journey/Journey.js";
import { JourneyFactory } from "../journey/JourneyFactory.js";
import { TimetableLegRepository } from "../pattern/repository/TimetableLegRepository.js";
import type { TransferPatternRepository } from "../pattern/repository/TransferPatternRepository.js";
import { TransferRepository } from "../pattern/repository/TransferRepository.js";
import { TransferPatternFactory } from "../pattern/TransferPatternFactory.js";
import { type OriginDepartureTimes, TransferPatternPlanner } from "../pattern/TransferPatternPlanner.js";
import type { JourneyFilter } from "./JourneyFilter.js";
import { MultipleCriteriaFilter } from "./MultipleCriteriaFilter.js";

/**
 * Search for journeys between a set of origin and destinations departing after a given time.
 *
 * A feed and the transfer patterns for it are all this needs, and both are loaded the same way
 * wherever this runs. The stop table is the one they were both read against, which is what lets
 * them speak of a station the same way:
 *
 * ```
 * const stops = new StopTable();
 * const [gtfs, patterns] = await Promise.all([
 *   loadGTFSFromUrl("gtfs.zip").then(feed => toGtfsData(feed, stops)),
 *   loadTransferPatternsFromUrl("transfer-patterns.br", { stops })
 * ]);
 *
 * const query = new DepartAfterQuery(gtfs, patterns, stops);
 * ```
 */
export class DepartAfterQuery {

  private readonly planner: TransferPatternPlanner;
  private readonly resultsFactory = new JourneyFactory();

  constructor(
    gtfs: GtfsData,
    patterns: TransferPatternRepository,
    private readonly stops: StopTable,
    private readonly filters: JourneyFilter[] = [new MultipleCriteriaFilter()]
  ) {
    this.planner = new TransferPatternPlanner(
      new TransferPatternFactory(
        patterns,
        new TimetableLegRepository(gtfs.trips, stops),
        new TransferRepository(gtfs.transfers),
        gtfs.interchange
      )
    );
  }

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
      .map(stop => this.stops.indexOf(stop))
      .filter(stop => stop !== UNKNOWN_STOP);
  }

  private getDateNumber(date: Date): number {
    const str = date.toISOString();

    return parseInt(str.slice(0, 4) + str.slice(5, 7) + str.slice(8, 10), 10);
  }

}
