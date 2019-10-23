import { TripIndex } from "../../gtfs/GtfsLoader";
import { DateNumber, DayOfWeek, StopID, StopTime, Trip } from "../../gtfs/Gtfs";
import { TimetableLeg } from "../../journey/Journey";
import * as memoize from "memoized-class-decorator";

/**
 * Provides access to the timetable legs by storing an index of every trip that runs between every origin and
 * destination
 */
export class TimetableLegRepository {

  constructor(
    private readonly index: TripIndex
  ) {}

  /**
   * Extract legs for every trip that runs between the origin and destination on the given date.
   *
   * Results are ordered by arrival time.
   */
  @memoize
  public getLegs(origin: StopID, destination: StopID, date: DateNumber, dow: DayOfWeek): TimetableLeg[] {
    if (!this.index[origin] || !this.index[origin][destination]) {
      return [];
    }

    return this.index[origin][destination]
      .filter(trip => trip.service.runsOn(date, dow))
      .map(trip => this.tripToLeg(trip, origin, destination))
      .sort((a, b) => a.stopTimes[a.stopTimes.length - 1].arrivalTime - b.stopTimes[b.stopTimes.length - 1].arrivalTime);
  }

  private tripToLeg(trip: Trip, origin: StopID, destination: StopID): TimetableLeg {
    const stopTimes = this.getStopTimes(trip, origin, destination);

    return { origin, destination, stopTimes, trip };
  }

  private getStopTimes(trip: Trip, origin: StopID, destination: StopID): StopTime[] {
    const i = trip.stopTimes.findIndex(c => c.stop === origin);

    for (let j = i + 1; j < trip.stopTimes.length; j++) {
      if (trip.stopTimes[j].stop === destination) {
        return trip.stopTimes.slice(i, j + 1);
      }
    }

    return [];
  }

}
