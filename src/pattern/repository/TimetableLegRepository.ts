import type { DateNumber, DayOfWeek, StopTime } from "@gb-transit/gtfs-loader";
import type { StopIdx, StopTable } from "../../gtfs/StopTable.js";
import type { TripCalls, TripIndex } from "../../gtfs/GtfsLoader.js";
import type { TimetableLeg } from "../../journey/Journey.js";

/** Stations fit in sixteen bits, so a pair of them fits in one number */
const ORIGIN_SHIFT = 16;

/**
 * Provides access to the timetable legs by storing an index of every trip that runs between every
 * origin and destination station
 */
export class TimetableLegRepository {

  /**
   * Legs already extracted, by the day they run on and then the pair they run between. A pattern
   * tree asks for the same origin, destination and date many times over, and pulling the calls out
   * of a trip is not free.
   */
  private readonly legs = new Map<number, Map<number, TimetableLeg[]>>();

  constructor(
    private readonly index: TripIndex,
    private readonly stops: StopTable
  ) {}

  /**
   * Extract legs for every trip that runs between the origin and destination station on the given
   * date.
   *
   * Results are ordered by arrival time.
   */
  public getLegs(origin: StopIdx, destination: StopIdx, date: DateNumber, dow: DayOfWeek): TimetableLeg[] {
    const day = date * 8 + dow;
    const pair = (origin << ORIGIN_SHIFT) | destination;

    let onDay = this.legs.get(day);

    if (onDay === undefined) {
      onDay = new Map();
      this.legs.set(day, onDay);
    }

    const cached = onDay.get(pair);

    if (cached) {
      return cached;
    }

    const legs = this.findLegs(origin, destination, date, dow);

    onDay.set(pair, legs);

    return legs;
  }

  private findLegs(origin: StopIdx, destination: StopIdx, date: DateNumber, dow: DayOfWeek): TimetableLeg[] {
    const trips = this.index[origin]?.get(destination);

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

  /**
   * A leg is a result, so this is where the stations it runs between are named again. They are named
   * once, when the leg is made, rather than every time a journey is built from it.
   */
  private tripToLeg(trip: TripCalls, origin: StopIdx, destination: StopIdx): TimetableLeg {
    return {
      origin: this.stops.nameOf(origin),
      destination: this.stops.nameOf(destination),
      stopTimes: this.getStopTimes(trip, origin, destination),
      trip: trip.trip
    };
  }

  /**
   * The calls between the two stations. The stop times are the feed's own, so a leg between two
   * stations still says which platform it uses at each end.
   */
  private getStopTimes(trip: TripCalls, origin: StopIdx, destination: StopIdx): StopTime[] {
    const i = trip.stations.indexOf(origin);

    for (let j = i + 1; j < trip.stations.length; j++) {
      if (trip.stations[j] === destination) {
        return trip.calls.slice(i, j + 1);
      }
    }

    return [];
  }

}
