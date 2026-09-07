import type { Duration, ServiceCalendar, StopID, StopTime, Time, Trip } from "@gb-transit/gtfs-loader";
import type { TripCalls } from "../../src/gtfs/GtfsLoader.js";
import type { TimetableLeg, Transfer } from "../../src/journey/Journey.js";

/**
 * A timetable leg between two stops, calling at both and nowhere else.
 */
export function tt(origin: StopID, destination: StopID, departureTime: Time, arrivalTime: Time): TimetableLeg {
  const stopTimes = [
    st(origin, departureTime),
    st(destination, arrivalTime)
  ];

  return {
    origin,
    destination,
    stopTimes,
    trip: { stopTimes } as Trip
  };
}

/**
 * A footpath, available all day.
 */
export function tr(origin: StopID, destination: StopID, duration: Duration): Transfer {
  return {
    origin,
    destination,
    duration,
    startTime: 0,
    endTime: Number.MAX_SAFE_INTEGER
  };
}

/**
 * A call at a stop, arriving and departing at the same time.
 */
export function st(stop: StopID, time: Time): StopTime {
  return { stop, pickUp: true, dropOff: true, departureTime: time, arrivalTime: time };
}

/**
 * A calendar that says yes to every date.
 */
const everyDay: ServiceCalendar = {
  runsOn: () => true,
  dayEarlier: () => everyDay
};

/**
 * A trip with the given calls that runs every day.
 */
export function trip(...stopTimes: StopTime[]): Trip {
  return { tripId: "1", serviceId: "1", service: everyDay, stopTimes };
}

/**
 * A trip as the index holds it, with every call usable and each stop its own station.
 */
export function calls(...stopTimes: StopTime[]): TripCalls {
  return {
    trip: trip(...stopTimes),
    calls: stopTimes,
    stations: stopTimes.map(s => s.stop)
  };
}
