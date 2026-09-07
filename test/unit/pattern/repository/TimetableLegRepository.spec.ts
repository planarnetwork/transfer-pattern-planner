import { describe, expect, it } from "vitest";
import type { TripCalls, TripIndex } from "../../../../src/gtfs/GtfsLoader.js";
import { TimetableLegRepository } from "../../../../src/pattern/repository/TimetableLegRepository.js";
import { calls, st } from "../../util.js";

describe("TimetableLegRepository", () => {

  it("returns legs between a given origin and destination", () => {
    const t = calls(
      st("A", 1000),
      st("B", 1005),
      st("C", 1010),
      st("D", 1015),
    );

    const repository = new TimetableLegRepository(createTripIndex([t]));
    const [leg] = repository.getLegs("B", "C", 1, 0);

    expect(leg.origin).toBe("B");
    expect(leg.destination).toBe("C");
    expect(leg.trip).toBe(t.trip);
    expect(leg.stopTimes.length).toBe(2);
  });

  it("sorts results by arrival time", () => {
    const t1 = calls(
      st("A", 1010),
      st("B", 1015),
      st("C", 1020),
      st("D", 1025),
    );

    const t2 = calls(
      st("A", 1000),
      st("B", 1005),
      st("C", 1010),
      st("D", 1015),
    );

    const repository = new TimetableLegRepository(createTripIndex([t1, t2]));
    const [leg1, leg2] = repository.getLegs("B", "C", 1, 0);

    expect(leg1.origin).toBe("B");
    expect(leg1.destination).toBe("C");
    expect(leg1.trip).toBe(t2.trip);
    expect(leg2.origin).toBe("B");
    expect(leg2.destination).toBe("C");
    expect(leg2.trip).toBe(t1.trip);
  });

  it("keeps the platform of each call in the leg's stop times", () => {
    const t: TripCalls = {
      ...calls(st("A1", 1000), st("B2", 1005)),
      stations: ["A", "B"]
    };

    const repository = new TimetableLegRepository({ A: { B: [t] } });
    const [leg] = repository.getLegs("A", "B", 1, 0);

    expect(leg.origin).toBe("A");
    expect(leg.destination).toBe("B");
    expect(leg.stopTimes.map(s => s.stop)).toEqual(["A1", "B2"]);
  });

});

function createTripIndex(trips: TripCalls[]): TripIndex {
  const tripIndex: TripIndex = {};

  for (const t of trips) {
    for (let i = 0; i < t.calls.length - 1; i++) {
      if (t.calls[i].pickUp) {
        for (let j = i + 1; j < t.calls.length; j++) {
          if (t.calls[j].dropOff) {
            const origin = t.stations[i];
            const destination = t.stations[j];

            tripIndex[origin] ??= {};
            tripIndex[origin][destination] ??= [];
            tripIndex[origin][destination].push(t);
          }
        }
      }
    }
  }

  return tripIndex;
}
