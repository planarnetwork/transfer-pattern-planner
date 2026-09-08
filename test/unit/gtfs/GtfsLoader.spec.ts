import type { GTFSFeed, Stop, StopID } from "@gb-transit/gtfs-loader";
import { describe, expect, it } from "vitest";
import type { GtfsData } from "../../../src/gtfs/GtfsLoader.js";
import { toGtfsData } from "../../../src/gtfs/GtfsLoader.js";
import { type StopTable, stopTable } from "../../../src/StopTable.js";
import { st, trip } from "../util.js";

/**
 * The index is kept in the terms the planner works in, so a spec asks it in station codes and gets
 * codes back rather than reading the numbers it holds them under.
 */
function destinationsFrom(gtfs: GtfsData, stops: StopTable, origin: StopID): StopID[] | undefined {
  const byDestination = gtfs.trips[stops.stopIndex.get(origin) as number];

  return byDestination && [...byDestination.keys()].map(stop => stops.stopIds[stop]);
}

function tripsBetween(gtfs: GtfsData, stops: StopTable, origin: StopID, destination: StopID) {
  return gtfs.trips[stops.stopIndex.get(origin) as number]?.get(stops.stopIndex.get(destination) as number);
}

function transfersBetween(gtfs: GtfsData, stops: StopTable, origin: StopID, destination: StopID) {
  return gtfs.transfers[stops.stopIndex.get(origin) as number]?.get(stops.stopIndex.get(destination) as number);
}

function stations(gtfs: GtfsData, stops: StopTable, origin: StopID, destination: StopID): StopID[] {
  const [trip] = tripsBetween(gtfs, stops, origin, destination) ?? [];

  return trip.stations.map(stop => stops.stopIds[stop]);
}

describe("toGtfsData", () => {

  it("indexes trips between the stations their platforms belong to", () => {
    const stops = stopTable();
    const gtfs = toGtfsData(feed({
      trips: [trip(st("NRW1", 1000), st("DIS2", 1100), st("LST8", 1200))]
    }), stops);

    expect(destinationsFrom(gtfs, stops, "NRW")).toEqual(["DIS", "LST"]);
    expect(destinationsFrom(gtfs, stops, "DIS")).toEqual(["LST"]);
    expect(tripsBetween(gtfs, stops, "NRW", "LST")?.length).toBe(1);
    expect(gtfs.stations.get("NRW1")).toBe("NRW");
  });

  it("keeps the feed's own stop times, so a leg still says which platform it uses", () => {
    const stops = stopTable();
    const gtfs = toGtfsData(feed({
      trips: [trip(st("NRW1", 1000), st("LST8", 1200))]
    }), stops);

    expect(tripsBetween(gtfs, stops, "NRW", "LST")?.[0].calls.map(c => c.stop)).toEqual(["NRW1", "LST8"]);
    expect(stations(gtfs, stops, "NRW", "LST")).toEqual(["NRW", "LST"]);
  });

  it("does not index a passing point, which a passenger cannot use", () => {
    const passing = { ...st("DIS2", 1100), pickUp: false, dropOff: false };

    const stops = stopTable();
    const gtfs = toGtfsData(feed({
      trips: [trip(st("NRW1", 1000), passing, st("LST8", 1200))]
    }), stops);

    expect(destinationsFrom(gtfs, stops, "DIS")).toBe(undefined);
    expect(tripsBetween(gtfs, stops, "NRW", "LST")?.length).toBe(1);
  });

  it("does not index a call it can only be boarded at as a destination", () => {
    const setDownOnly = { ...st("LST8", 1200), pickUp: true, dropOff: false };

    const stops = stopTable();
    const gtfs = toGtfsData(feed({
      trips: [trip(st("NRW1", 1000), setDownOnly)]
    }), stops);

    expect(destinationsFrom(gtfs, stops, "NRW")).toBe(undefined);
  });

  it("does not index a leg between two platforms of one station", () => {
    const stops = stopTable();
    const gtfs = toGtfsData(feed({
      trips: [trip(st("NRW1", 1000), st("NRW2", 1005), st("LST8", 1200))]
    }), stops);

    expect(tripsBetween(gtfs, stops, "NRW", "NRW")).toBe(undefined);
    expect(destinationsFrom(gtfs, stops, "NRW")).toEqual(["LST"]);
  });

  it("adds the trip a passenger stays on across a coupling", () => {
    const front = { ...trip(st("NRW1", 1000), st("DIS2", 1100)), tripId: "front" };
    const rear = { ...trip(st("DIS2", 1130), st("LST8", 1230)), tripId: "rear" };

    const stops = stopTable();
    const gtfs = toGtfsData(feed({
      trips: [front, rear],
      links: [{ fromTripId: "front", toTripId: "rear", fromStop: "DIS2", toStop: "DIS2" }]
    }), stops);

    // NRW to LST is only reachable on the through trip, the two portions alone never call at both
    expect(tripsBetween(gtfs, stops, "NRW", "LST")?.length).toBe(1);
    expect(tripsBetween(gtfs, stops, "NRW", "LST")?.[0].trip.tripId).toBe("front_rear");
  });

  it("indexes footpaths between stations and drops those within one", () => {
    const stops = stopTable();
    const gtfs = toGtfsData(feed({
      transfers: {
        NRW1: [
          transfer("NRW1", "NRW2", 300),
          transfer("NRW1", "DIS2", 600)
        ]
      }
    }), stops);

    expect(transfersBetween(gtfs, stops, "NRW", "NRW")).toBe(undefined);
    expect(transfersBetween(gtfs, stops, "NRW", "DIS")?.length).toBe(1);
    expect(transfersBetween(gtfs, stops, "NRW", "DIS")?.[0].duration).toBe(600);
  });

  it("reports interchange time against the station", () => {
    const stops = stopTable();
    const gtfs = toGtfsData(feed({ interchange: { NRW1: 300 } }), stops);

    expect(gtfs.interchange[stops.stopIndex.get("NRW") as number]).toBe(300);
  });

});

/**
 * A feed whose stops are platforms, each belonging to a station named by its stop_code. That is how
 * the feeds this is used with identify a station, and what `normalise` resolves a call to.
 */
function feed(overrides: Partial<GTFSFeed> = {}): GTFSFeed {
  return {
    trips: [],
    transfers: {},
    links: [],
    interchange: {},
    stops: {
      NRW: station("NRW"),
      NRW1: platform("NRW1", "NRW"),
      NRW2: platform("NRW2", "NRW"),
      DIS: station("DIS"),
      DIS2: platform("DIS2", "DIS"),
      LST: station("LST"),
      LST8: platform("LST8", "LST")
    },
    ...overrides
  };
}

function station(id: StopID): Stop {
  return { id, code: id, latitude: 0, longitude: 0, locationType: 1 };
}

function platform(id: StopID, parentStation: StopID): Stop {
  return { id, latitude: 0, longitude: 0, locationType: 0, parentStation };
}

function transfer(origin: StopID, destination: StopID, duration: number) {
  return { origin, destination, duration, startTime: 0, endTime: Number.MAX_SAFE_INTEGER };
}
