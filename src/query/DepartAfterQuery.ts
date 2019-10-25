import { keyValue } from "ts-array-utils";
import { JourneyFactory } from "../journey/JourneyFactory";
import { DayOfWeek, StopID, Time } from "../gtfs/Gtfs";
import { Journey } from "../journey/Journey";
import { JourneyFilter } from "./JourneyFilter";
import { TransferPatternPlanner } from "../pattern/TransferPatternPlanner";

/**
 * Search for journeys between a set of origin and destinations departing after a given time.
 */
export class DepartAfterQuery {

  constructor(
    private readonly planner: TransferPatternPlanner,
    private readonly resultsFactory: JourneyFactory,
    private readonly filters: JourneyFilter[] = []
  ) { }

  /**
   * Plan a journey between the origin and destination set of stops on the given date and time
   */
  public async plan(origins: StopID[], destinations: StopID[], date: Date, time: Time): Promise<Journey[]> {
    const originTimes = origins.reduce(keyValue(origin => [origin, time]), {});
    const dateNumber = this.getDateNumber(date);
    const dayOfWeek = date.getDay() as DayOfWeek;
    const journeyLegs = await this.planner.plan(originTimes, destinations, dateNumber, dayOfWeek);
    const journeys = journeyLegs.map(legs => this.resultsFactory.getJourney(legs));

    // apply each filter to the results
    return this.filters.reduce((rs, filter) => filter.apply(rs), journeys);
  }

  private getDateNumber(date: Date): number {
    const str = date.toISOString();

    return parseInt(str.slice(0, 4) + str.slice(5, 7) + str.slice(8, 10), 10);
  }

}
