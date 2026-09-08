import type { Duration, ServiceCalendar, StopID, StopTime, Time, Trip } from "@gb-transit/gtfs-loader";
import type { TripCalls } from "../../src/gtfs/GtfsLoader.js";
import type { TimetableLeg, Transfer } from "../../src/journey/Journey.js";
import { internStop, type StopIdx, type StopTable, stopTable } from "../../src/StopTable.js";

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
export function calls(stops: StopTable, ...stopTimes: StopTime[]): TripCalls {
  return {
    trip: trip(...stopTimes),
    calls: stopTimes,
    stations: stopTimes.map(s => internStop(stops, s.stop))
  };
}

/**
 * A stop table with the given stations numbered in the order they are given.
 */
export function stopsFor(...codes: StopID[]): StopTable {
  const stops = stopTable();

  for (const code of codes) {
    internStop(stops, code);
  }

  return stops;
}

/**
 * The index of a station, for a spec that has to ask in the terms the planner works in.
 */
export function at(stops: StopTable, code: StopID): StopIdx {
  return stops.stopIndex.get(code) as StopIdx;
}

/**
 * Name the stops of each pattern, so that a spec can say what it means.
 */
export function named(stops: StopTable, patterns: StopIdx[][]): StopID[][] {
  return patterns.map(pattern => pattern.map(stop => stops.stopIds[stop]));
}

/**
 * An index of things between a pair of stations, as the planner holds them.
 */
export function between<T>(
  stops: StopTable,
  entries: [StopID, StopID, T[]][]
): (Map<StopIdx, T[]> | undefined)[] {
  const index: (Map<StopIdx, T[]> | undefined)[] = [];

  for (const [origin, destination, values] of entries) {
    const from = internStop(stops, origin);
    const byDestination = index[from] ?? new Map();

    byDestination.set(internStop(stops, destination), values);
    index[from] = byDestination;
  }

  return index;
}
