import { describe, expect, it } from "vitest";
import { JourneyFactory } from "../../../src/journey/JourneyFactory.js";
import { tr, tt } from "../util.js";

describe("JourneyFactory", () => {
  const factory = new JourneyFactory();

  it("creates a journey from legs", () => {
    const journey = factory.getJourney([
      tt("A", "B", 1000, 1015),
      tt("B", "C", 1015, 1030)
    ]);

    expect(journey.origin).toBe("A");
    expect(journey.destination).toBe("C");
    expect(journey.departureTime).toBe(1000);
    expect(journey.arrivalTime).toBe(1030);
  });

  it("calculates the departure time", () => {
    const journey = factory.getJourney([
      tr("A", "B", 15),
      tt("B", "C", 1015, 1030)
    ]);

    expect(journey.origin).toBe("A");
    expect(journey.destination).toBe("C");
    expect(journey.departureTime).toBe(1000);
    expect(journey.arrivalTime).toBe(1030);
  });

  it("calculates the arrival time", () => {
    const journey = factory.getJourney([
      tt("A", "B", 1000, 1015),
      tr("B", "C", 15)
    ]);

    expect(journey.origin).toBe("A");
    expect(journey.destination).toBe("C");
    expect(journey.departureTime).toBe(1000);
    expect(journey.arrivalTime).toBe(1030);
  });

});
