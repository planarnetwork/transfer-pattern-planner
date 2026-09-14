import { getDateNumber, getDayOfWeek, Service } from "@gb-transit/gtfs-loader";
import type { DateNumber, StopID, Trip, TripID } from "@gb-transit/gtfs-loader";
import { type Connections, type GtfsData, StopTable, TripCalendar } from "connection-scan-algorithm";

/**
 * A connection scan timetable for one date, in a form that can be posted to a worker.
 *
 * A GtfsData holds the feed's trips and calendars as objects, which a worker would be given a copy
 * of, and a pattern needs none of them: only the connections that run on the date, and the footpaths
 * and interchange between them. Those are all typed arrays, and they are allocated on
 * SharedArrayBuffers where there are any, so every worker reads the same bytes.
 */
export interface SharedTimetable {
  date: DateNumber;
  /** the connections running on the date, their trips numbered among those that run */
  connections: Connections;
  footpaths: Pick<GtfsData["transfers"], "offsets" | "origin" | "destination" | "duration">;
  interchange: Int32Array;
  /** the code of each station, by index */
  stations: StopID[];
  /** the feed's id of each trip, by index */
  tripIds: TripID[];
}

/**
 * The connections that run on the date, and what a scan of them reads, ready to be posted to a
 * worker
 */
export function shareTimetable(gtfs: GtfsData, dateObj: Date): SharedTimetable {
  const date = getDateNumber(dateObj);
  const running = gtfs.calendar.runningOn(date, getDayOfWeek(date));
  const { connections, transfers } = gtfs;
  const tripIndex = new Int32Array(gtfs.trips.length).fill(-1);
  const tripIds: TripID[] = [];

  let length = 0;

  for (let c = 0; c < connections.length; c++) {
    const trip = connections.trip[c];

    if (running[trip]) {
      length++;

      if (tripIndex[trip] === -1) {
        tripIndex[trip] = tripIds.length;
        tripIds.push(gtfs.trips[trip].tripId);
      }
    }
  }

  const shared: Connections = {
    length,
    departureStation: sharedInt32Array(length),
    arrivalStation: sharedInt32Array(length),
    departureTime: sharedInt32Array(length),
    arrivalTime: sharedInt32Array(length),
    trip: sharedInt32Array(length),
    board: sharedInt32Array(length),
    alight: sharedInt32Array(length)
  };

  for (let c = 0, to = 0; c < connections.length; c++) {
    if (running[connections.trip[c]]) {
      shared.departureStation[to] = connections.departureStation[c];
      shared.arrivalStation[to] = connections.arrivalStation[c];
      shared.departureTime[to] = connections.departureTime[c];
      shared.arrivalTime[to] = connections.arrivalTime[c];
      shared.trip[to] = tripIndex[connections.trip[c]];
      shared.board[to] = connections.board[c];
      shared.alight[to] = connections.alight[c];
      to++;
    }
  }

  return {
    date,
    connections: shared,
    footpaths: {
      offsets: share(transfers.offsets),
      origin: share(transfers.origin),
      destination: share(transfers.destination),
      duration: share(transfers.duration)
    },
    interchange: share(gtfs.interchange),
    stations: Array.from({ length: gtfs.stopTable.size }, (_, station) => gtfs.stopTable.nameOf(station)),
    tripIds
  };
}

/**
 * The timetable a connection scan reads, from one that was shared.
 *
 * Its trips carry no stop times, since nothing that makes a pattern reads them, and each runs on the
 * shared date and no other, which is all the calendar is asked.
 */
export function readSharedTimetable(shared: SharedTimetable): GtfsData {
  const stopTable = new StopTable();
  const service = new Service(shared.date, shared.date, { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true }, {});
  const trips: Trip[] = shared.tripIds.map(tripId => ({ tripId, serviceId: "", stopTimes: [], service }));

  for (const station of shared.stations) {
    stopTable.intern(station);
  }

  return {
    connections: shared.connections,
    transfers: { ...shared.footpaths, transfer: [] },
    interchange: shared.interchange,
    calendar: new TripCalendar(trips),
    trips,
    stopTable,
    stops: {},
    stations: new Map()
  };
}

const canShareMemory = typeof SharedArrayBuffer !== "undefined";

function sharedInt32Array(length: number): Int32Array {
  return canShareMemory
    ? new Int32Array(new SharedArrayBuffer(length * Int32Array.BYTES_PER_ELEMENT))
    : new Int32Array(length);
}

function share(array: Int32Array): Int32Array {
  const shared = sharedInt32Array(array.length);

  shared.set(array);

  return shared;
}
