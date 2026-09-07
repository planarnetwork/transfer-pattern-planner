import type { DateNumber, DayOfWeek, StopID, StopTime } from "@gb-transit/gtfs-loader";
import type { TripCalls, TripIndex } from "../../gtfs/GtfsLoader.js";
import type { TimetableLeg } from "../../journey/Journey.js";

/**
 * Provides access to the timetable legs by storing an index of every trip that runs between every
 * origin and destination station
 */
export class TimetableLegRepository {

  /**
   * Legs already extracted, keyed by the arguments they were asked for. A pattern tree asks for the
   * same origin, destination and date many times over, and pulling the calls out of a trip is not
   * free.
   */
  private readonly legs = new Map<string, TimetableLeg[]>();

  constructor(
    private readonly index: TripIndex
  ) {}

  /**
   * Extract legs for every trip that runs between the origin and destination station on the given
   * date.
   *
   * Results are ordered by arrival time.
   */
  public getLegs(origin: StopID, destination: StopID, date: DateNumber, dow: DayOfWeek): TimetableLeg[] {
    const key = `${origin}|${destination}|${date}|${dow}`;
    const cached = this.legs.get(key);

    if (cached) {
      return cached;
    }

    const legs = this.findLegs(origin, destination, date, dow);

    this.legs.set(key, legs);

    return legs;
  }

  private findLegs(origin: StopID, destination: StopID, date: DateNumber, dow: DayOfWeek): TimetableLeg[] {
    const trips = this.index[origin]?.[destination];

    if (!trips) {
      return [];
    }

    return trips
      .filter(trip => trip.trip.service.runsOn(date, dow))
      .map(trip => this.tripToLeg(trip, origin, destination))
      .sort(
        (a, b) => a.stopTimes[a.stopTimes.length - 1].arrivalTime - b.stopTimes[b.stopTimes.length - 1].arrivalTime
      );
  }

  private tripToLeg(trip: TripCalls, origin: StopID, destination: StopID): TimetableLeg {
    return {
      origin,
      destination,
      stopTimes: this.getStopTimes(trip, origin, destination),
      trip: trip.trip
    };
  }

  /**
   * The calls between the two stations. The stop times are the feed's own, so a leg between two
   * stations still says which platform it uses at each end.
   */
  private getStopTimes(trip: TripCalls, origin: StopID, destination: StopID): StopTime[] {
    const i = trip.stations.indexOf(origin);

    for (let j = i + 1; j < trip.stations.length; j++) {
      if (trip.stations[j] === destination) {
        return trip.calls.slice(i, j + 1);
      }
    }

    return [];
  }

}
