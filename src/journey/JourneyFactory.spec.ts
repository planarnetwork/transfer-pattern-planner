import * as chai from "chai";
import { JourneyFactory } from "./JourneyFactory";
import { Duration, StopID, Time } from "../gtfs/Gtfs";
import { TimetableLeg, Transfer } from "./Journey";

describe("JourneyFactory", () => {
  const factory = new JourneyFactory();

  it("creates a journey from legs", () => {
    const legs = [
      tt("A", "B", 1000, 1015),
      tt("B", "C", 1015, 1030)
    ];

    const journey = factory.getJourney(legs);

    chai.expect(journey.origin).to.equal("A");
    chai.expect(journey.destination).to.equal("C");
    chai.expect(journey.departureTime).to.equal(1000);
    chai.expect(journey.arrivalTime).to.equal(1030);
  });

  it("calculates the departure time", () => {
    const legs = [
      tr("A", "B", 15),
      tt("B", "C", 1015, 1030)
    ];

    const journey = factory.getJourney(legs);

    chai.expect(journey.origin).to.equal("A");
    chai.expect(journey.destination).to.equal("C");
    chai.expect(journey.departureTime).to.equal(1000);
    chai.expect(journey.arrivalTime).to.equal(1030);
  });

  it("calculates the arrival time", () => {
    const legs = [
      tt("A", "B", 1000, 1015),
      tr("B", "C", 15),
    ];

    const journey = factory.getJourney(legs);

    chai.expect(journey.origin).to.equal("A");
    chai.expect(journey.destination).to.equal("C");
    chai.expect(journey.departureTime).to.equal(1000);
    chai.expect(journey.arrivalTime).to.equal(1030);
  });

});

export function tt(origin: StopID, destination: StopID, departureTime: Time, arrivalTime: Time): TimetableLeg {
  const stopTimes = [
    { stop: origin, pickUp: true, dropOff: true, arrivalTime: departureTime, departureTime: departureTime },
    { stop: destination, pickUp: true, dropOff: true, arrivalTime: arrivalTime, departureTime: arrivalTime }
  ];

  return {
    origin,
    destination,
    stopTimes,
    trip: { stopTimes } as any
  };
}

export function tr(origin: StopID, destination: StopID, duration: Duration): Transfer {
  return {
    origin,
    destination,
    duration,
    startTime: 0,
    endTime: Number.MAX_SAFE_INTEGER
  };
}
