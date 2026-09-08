import { Service } from "@gb-transit/gtfs-loader";
import type {
  GTFSFeed, Interchange, StopID, StopIndex, StopTime, Time, Transfer, TransfersByOrigin, Trip,
  TripLink
} from "@gb-transit/gtfs-loader";

/**
 * Fixtures for the generator, which works from a feed rather than from the indexes the planner
 * reads. They are kept apart from `test/unit/util.ts` because both name a `st` and the two mean
 * different things: this one takes the calls a trip makes, that one a call at a time.
 */

const allDays = { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true };

const everyDay = new Service(20180101, 20991231, allDays, {});

/**
 * A feed of the given trips, with a calendar wide enough for every date the specs plan for.
 */
export function feed(
  trips: Trip[],
  transfers: TransfersByOrigin = {},
  interchange: Interchange = {},
  stops: StopIndex = {},
  links: TripLink[] = []
): GTFSFeed {
  return {
    trips,
    transfers,
    links,
    interchange,
    stops,
    feedInfo: { startDate: 20180101, endDate: 20201231 }
  };
}

let tripId = 0;

/**
 * A trip with the given calls that runs every day.
 */
export function t(...stopTimes: StopTime[]): Trip {
  return {
    tripId: `trip${tripId++}`,
    stopTimes,
    serviceId: "1",
    service: everyDay
  };
}

/**
 * A call at a stop. A null arrival is a pick up only, a null departure a set down only.
 */
export function st(stop: StopID, arrivalTime: Time | null, departureTime: Time | null): StopTime {
  return {
    stop,
    arrivalTime: arrivalTime ?? (departureTime as Time),
    departureTime: departureTime ?? (arrivalTime as Time),
    dropOff: arrivalTime !== null,
    pickUp: departureTime !== null
  };
}

/**
 * A footpath, available all day.
 */
export function tf(origin: StopID, destination: StopID, duration: Time): Transfer {
  return { origin, destination, duration, startTime: 0, endTime: Number.MAX_SAFE_INTEGER };
}
