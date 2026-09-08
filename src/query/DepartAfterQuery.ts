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
 * wherever this runs. They are read against one stop table, which is what lets them speak of a
 * station the same way, and the feed carries it here:
 *
 * ```
 * const stops = new StopTable();
 * const [gtfs, patterns] = await Promise.all([
 *   loadGTFSFromUrl("gtfs.zip").then(feed => toGtfsData(feed, stops)),
 *   loadTransferPatternsFromUrl("transfer-patterns.br", { stops })
 * ]);
 *
 * const query = new DepartAfterQuery(gtfs, patterns);
 * ```
 */
export class DepartAfterQuery {

  private readonly planner: TransferPatternPlanner;
  private readonly resultsFactory = new JourneyFactory();
  private readonly stops: StopTable;

  constructor(
    gtfs: GtfsData,
    private readonly patterns: TransferPatternRepository,
    private readonly filters: JourneyFilter[] = [new MultipleCriteriaFilter()]
  ) {
    this.stops = gtfs.stops;
    this.planner = new TransferPatternPlanner(
      new TransferPatternFactory(
        patterns,
        new TimetableLegRepository(gtfs.trips, gtfs.stops),
        new TransferRepository(gtfs.transfers),
        gtfs.interchange
      )
    );
  }

  /**
   * Plan a journey between the origin and destination set of stops on the given date and time.
   *
   * A repository that does not hold every pattern is given the origins first: it cannot go and read
   * a station while the planning is under way, since none of that is awaited.
   */
  public async plan(origins: StopID[], destinations: StopID[], date: Date, time: Time): Promise<Journey[]> {
    // the planner works in stop indexes, the query in the codes the caller knows
    const from = this.toStopIndexes(origins);

    await this.patterns.prepare?.(from);

    const originTimes: OriginDepartureTimes = new Map(from.map(stop => [stop, time]));

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

  // read in local time to agree with getDay(), otherwise the date and the day of week can describe different days
  private getDateNumber(date: Date): number {
    return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  }

}
