import {
  type GTFSFeed, type GTFSSource, type Interchange, loadGTFS, normalise, type StopID, type StopIndex,
  type StopTime, type Trip
} from "@gb-transit/gtfs-loader";
import type { Transfer } from "../journey/Journey.js";

/**
 * Returns trips, transfers, interchange time and calendars from a GTFS zip.
 */
export async function loadGtfs(source: GTFSSource): Promise<GtfsData> {
  return toGtfsData(await loadGTFS(source));
}

/**
 * Puts a feed into the terms this planner works in.
 *
 * Reading the feed is `@gb-transit/gtfs-loader`'s job, and `normalise` puts what it read into the
 * terms a journey planner needs: stops resolved to the station they belong to, footpaths and
 * interchange times defined at those stations, the calls a passenger can actually use picked out of
 * each trip, and a trip added for each coupling so that staying on a vehicle that carries on as
 * another service is planned as one trip rather than a change.
 *
 * What is left here is turning that into the indexes a transfer pattern is read against: a pattern
 * names the stations a journey calls at, so the question asked of the timetable is always "what runs
 * between these two stations", and that is answered by indexing every pair of stations a trip can be
 * boarded and alighted between.
 */
export function toGtfsData(feed: GTFSFeed): GtfsData {
  const { trips, calls, transfers, interchange, stations } = normalise(feed);

  return {
    trips: indexTripsByLeg(trips, calls, stations),
    transfers: indexTransfersByDestination(transfers),
    interchange,
    stops: feed.stops,
    stations
  };
}

/**
 * Index every trip under each pair of stations it can be boarded and alighted between, obeying the
 * pick up and set down markers of its calls.
 */
function indexTripsByLeg(trips: Trip[], calls: StopTime[][], stations: Map<StopID, StopID>): TripIndex {
  const index: TripIndex = {};

  for (let t = 0; t < trips.length; t++) {
    const trip: TripCalls = {
      trip: trips[t],
      calls: calls[t],
      stations: calls[t].map(c => stations.get(c.stop) ?? c.stop)
    };

    for (let i = 0; i < trip.calls.length - 1; i++) {
      if (trip.calls[i].pickUp) {
        for (let j = i + 1; j < trip.calls.length; j++) {
          // two calls at one station are a stop and a start, not a journey between places
          if (trip.calls[j].dropOff && trip.stations[i] !== trip.stations[j]) {
            addTrip(index, trip.stations[i], trip.stations[j], trip);
          }
        }
      }
    }
  }

  return index;
}

/**
 * `normalise` returns footpaths as a flat list, the planner asks for them by origin and destination.
 */
function indexTransfersByDestination(transfers: Transfer[]): TransferIndex {
  const index: TransferIndex = {};

  for (const transfer of transfers) {
    index[transfer.origin] ??= {};
    index[transfer.origin][transfer.destination] ??= [];
    index[transfer.origin][transfer.destination].push(transfer);
  }

  return index;
}

function addTrip(index: TripIndex, origin: StopID, destination: StopID, trip: TripCalls): void {
  index[origin] ??= {};
  index[origin][destination] ??= [];
  index[origin][destination].push(trip);
}

/**
 * A trip as the planner reads it: the calls a passenger can use, and the station each one is at.
 *
 * The feed's stop times are not rewritten, so a trip keeps the stopping pattern it was published
 * with, passing points and all. Where a call is is answered here instead. One of these is made per
 * trip and shared by every entry of the index that names it.
 */
export interface TripCalls {
  trip: Trip;
  /** the calls a passenger can board or alight at, in order */
  calls: StopTime[];
  /** the station of each call, parallel to `calls` */
  stations: StopID[];
}

/**
 * Trips indexed by the origin and destination station they can be used between
 */
export type TripIndex = Record<StopID, Record<StopID, TripCalls[]>>;

/**
 * Transfers indexed by origin and destination station
 */
export type TransferIndex = Record<StopID, Record<StopID, Transfer[]>>;

/**
 * Contents of the GTFS zip file
 */
export type GtfsData = {
  trips: TripIndex,
  transfers: TransferIndex,
  interchange: Interchange,
  /** the feed's stops, as it gave them, which may identify individual platforms */
  stops: StopIndex,
  /** feed stop id to the station it belongs to, which is what journeys are planned between */
  stations: Map<StopID, StopID>
};
