import type { StopID } from "@gb-transit/gtfs-loader";
import { describe, expect, it } from "vitest";
import type { InterchangeTimes, TripCalls, TripIndex } from "../../../src/gtfs/GtfsLoader.js";
import type { StopIdx, StopTable } from "../../../src/gtfs/StopTable.js";
import type { AnyLeg } from "../../../src/journey/Journey.js";
import { TimetableLegRepository } from "../../../src/pattern/repository/TimetableLegRepository.js";
import type { TransferPatternRepository } from "../../../src/pattern/repository/TransferPatternRepository.js";
import { TransferRepository } from "../../../src/pattern/repository/TransferRepository.js";
import { TransferPatternFactory } from "../../../src/pattern/TransferPatternFactory.js";
import { at, between, calls, st, stopsFor } from "../util.js";

describe("TransferPatternFactory", () => {

  it("keeps patterns that change at another origin in the group", () => {
    const stops = stopsFor("BHM", "BHI", "EUS");
    const factory = createFactory(
      stops,
      [["BHM", "EUS", [["BHI"]]]],
      [
        calls(stops, st("BHM", 1000), st("BHI", 1015)),
        calls(stops, st("BHI", 1030), st("EUS", 1200))
      ]
    );

    const [newStreet] = factory.getTransferPatterns(
      [at(stops, "BHM"), at(stops, "BHI")],
      [at(stops, "EUS")],
      20260908,
      2
    );

    const journeys = newStreet.getJourneys(departingAt(stops, 1000, "BHM", "BHI"));

    expect(journeys.map(route)).toEqual([["BHM-BHI", "BHI-EUS"]]);
  });

  it("drops patterns that change at another destination in the group", () => {
    const stops = stopsFor("NRW", "MYB", "EUS");
    const factory = createFactory(
      stops,
      [["NRW", "EUS", [["MYB"]]], ["NRW", "MYB", [[]]]],
      [
        calls(stops, st("NRW", 1000), st("MYB", 1200)),
        calls(stops, st("MYB", 1215), st("EUS", 1230))
      ]
    );

    const [norwich] = factory.getTransferPatterns(
      [at(stops, "NRW")],
      [at(stops, "EUS"), at(stops, "MYB")],
      20260908,
      2
    );

    const journeys = norwich.getJourneys(departingAt(stops, 1000, "NRW"));

    expect(journeys.map(route)).toEqual([["NRW-MYB"]]);
  });

});

/** Five minutes to change at any of the three stations these specs name */
const interchange: InterchangeTimes = [5, 5, 5];

/**
 * A factory that plans the given patterns against the given trips.
 */
function createFactory(
  stops: StopTable,
  patterns: [StopID, StopID, StopID[][]][],
  trips: TripCalls[]
): TransferPatternFactory {
  return new TransferPatternFactory(
    createPatternRepository(stops, patterns),
    new TimetableLegRepository(createTripIndex(trips), stops),
    new TransferRepository([]),
    interchange
  );
}

/**
 * A repository holding the given patterns, which are named in station codes so that a spec can say
 * what it means.
 */
function createPatternRepository(
  stops: StopTable,
  patterns: [StopID, StopID, StopID[][]][]
): TransferPatternRepository {
  const index = between<StopIdx[]>(
    stops,
    patterns.map(([origin, destination, stations]) => [
      origin,
      destination,
      stations.map(pattern => pattern.map(stop => at(stops, stop)))
    ])
  );

  return {
    getPatterns: (origin, destination) => index[origin]?.get(destination) ?? []
  };
}

function createTripIndex(trips: TripCalls[]): TripIndex {
  const index: TripIndex = [];

  for (const trip of trips) {
    const [origin, destination] = trip.stations;
    const byDestination = index[origin] ?? new Map();

    byDestination.set(destination, [trip]);
    index[origin] = byDestination;
  }

  return index;
}

function departingAt(stops: StopTable, time: number, ...codes: StopID[]): Map<StopIdx, number> {
  return new Map(codes.map(code => [at(stops, code), time]));
}

function route(legs: AnyLeg[]): string[] {
  return legs.map(l => `${l.origin}-${l.destination}`);
}
