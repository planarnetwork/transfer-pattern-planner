import { describe, expect, it } from "vitest";
import type { TripCalls, TripIndex } from "../../../../src/gtfs/GtfsLoader.js";
import { TimetableLegRepository } from "../../../../src/pattern/repository/TimetableLegRepository.js";
import type { StopIdx } from "../../../../src/gtfs/StopTable.js";
import { at, calls, st, stopsFor } from "../../util.js";

describe("TimetableLegRepository", () => {

  it("returns legs between a given origin and destination", () => {
    const stops = stopsFor();
    const t = calls(
      stops,
      st("A", 1000),
      st("B", 1005),
      st("C", 1010),
      st("D", 1015),
    );

    const repository = new TimetableLegRepository(createTripIndex([t]), stops);
    const [leg] = repository.getLegs(at(stops, "B"), at(stops, "C"), 1, 0);

    expect(leg.origin).toBe("B");
    expect(leg.destination).toBe("C");
    expect(leg.trip).toBe(t.trip);
    expect(leg.stopTimes.length).toBe(2);
  });

  it("sorts results by arrival time", () => {
    const stops = stopsFor();
    const t1 = calls(
      stops,
      st("A", 1010),
      st("B", 1015),
      st("C", 1020),
      st("D", 1025),
    );

    const t2 = calls(
      stops,
      st("A", 1000),
      st("B", 1005),
      st("C", 1010),
      st("D", 1015),
    );

    const repository = new TimetableLegRepository(createTripIndex([t1, t2]), stops);
    const [leg1, leg2] = repository.getLegs(at(stops, "B"), at(stops, "C"), 1, 0);

    expect(leg1.origin).toBe("B");
    expect(leg1.destination).toBe("C");
    expect(leg1.trip).toBe(t2.trip);
    expect(leg2.origin).toBe("B");
    expect(leg2.destination).toBe("C");
    expect(leg2.trip).toBe(t1.trip);
  });

  it("keeps the platform of each call in the leg's stop times", () => {
    const stops = stopsFor("A", "B");
    const t: TripCalls = {
      ...calls(stops, st("A1", 1000), st("B2", 1005)),
      stations: [at(stops, "A"), at(stops, "B")]
    };

    const repository = new TimetableLegRepository(createTripIndex([t]), stops);
    const [leg] = repository.getLegs(at(stops, "A"), at(stops, "B"), 1, 0);

    expect(leg.origin).toBe("A");
    expect(leg.destination).toBe("B");
    expect(leg.stopTimes.map(s => s.stop)).toEqual(["A1", "B2"]);
  });

});

function createTripIndex(trips: TripCalls[]): TripIndex {
  const tripIndex: TripIndex = [];

  for (const t of trips) {
    for (let i = 0; i < t.calls.length - 1; i++) {
      if (t.calls[i].pickUp) {
        for (let j = i + 1; j < t.calls.length; j++) {
          if (t.calls[j].dropOff) {
            add(tripIndex, t.stations[i], t.stations[j], t);
          }
        }
      }
    }
  }

  return tripIndex;
}

function add(index: TripIndex, origin: StopIdx, destination: StopIdx, trip: TripCalls): void {
  const byDestination = index[origin] ?? new Map();
  const trips = byDestination.get(destination) ?? [];

  trips.push(trip);
  byDestination.set(destination, trips);
  index[origin] = byDestination;
}
