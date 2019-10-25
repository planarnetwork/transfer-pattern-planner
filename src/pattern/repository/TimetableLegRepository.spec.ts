import * as chai from "chai";
import { StopID, StopTime, Time, Trip } from "../../gtfs/Gtfs";
import { TripIndex } from "../../gtfs/GtfsLoader";
import { pushNested } from "ts-array-utils";
import { TimetableLegRepository } from "./TimetableLegRepository";

describe("TimetableLegRepository", () => {

  it("returns legs between a given origin and destination", () => {
    const t = createTrip(
      st("A", 1000),
      st("B", 1005),
      st("C", 1010),
      st("D", 1015),
    );

    const tripIndex = createTripIndex([t]);
    const repository = new TimetableLegRepository(tripIndex);
    const [leg] = repository.getLegs("B", "C", 1, 0);

    chai.expect(leg.origin).to.equal("B");
    chai.expect(leg.destination).to.equal("C");
    chai.expect(leg.trip).to.equal(t);
    chai.expect(leg.stopTimes.length).to.equal(2);
  });

  it("sorts results by arrival time", () => {
    const t1 = createTrip(
      st("A", 1010),
      st("B", 1015),
      st("C", 1020),
      st("D", 1025),
    );

    const t2 = createTrip(
      st("A", 1000),
      st("B", 1005),
      st("C", 1010),
      st("D", 1015),
    );

    const tripIndex = createTripIndex([t1, t2]);
    const repository = new TimetableLegRepository(tripIndex);
    const [leg1, leg2] = repository.getLegs("B", "C", 1, 0);

    chai.expect(leg1.origin).to.equal("B");
    chai.expect(leg1.destination).to.equal("C");
    chai.expect(leg1.trip).to.equal(t2);
    chai.expect(leg2.origin).to.equal("B");
    chai.expect(leg2.destination).to.equal("C");
    chai.expect(leg2.trip).to.equal(t1);
  });

});

function createTrip(...stopTimes: StopTime[]): Trip {
  return {
    tripId: "1",
    serviceId: "1",
    service: { runsOn: () => true } as any,
    stopTimes
  };
}

function st(stop: StopID, time: Time): StopTime {
  return { stop, pickUp: true, dropOff: true, departureTime: time, arrivalTime: time };
}

function createTripIndex(trips: Trip[]): TripIndex {
  const tripIndex = {};

  for (const trip of trips) {
    for (let i = 0; i < trip.stopTimes.length - 1; i++) {
      if (trip.stopTimes[i].pickUp) {
        for (let j = i + 1; j < trip.stopTimes.length; j++) {
          if (trip.stopTimes[j].dropOff) {
            pushNested(trip, tripIndex, trip.stopTimes[i].stop, trip.stopTimes[j].stop);
          }
        }
      }
    }
  }

  return tripIndex;
}
