import * as chai from "chai";
import { JourneyFactory } from "./JourneyFactory";

describe("JourneyFactory", () => {
  const factory = new JourneyFactory();

  it("creates a journey from legs", () => {
    const results = new ScanResults({ A: 1000 }, {});
    const connections = [
      c("A", "B", 1000, 1030)
    ];

    setStopTimes(connections);

    for (const connection of connections) {
      results.setConnection(connection);
    }

    const [journey] = factory.getJourneys(results.getConnectionIndex(), ["B"]);

    chai.expect(journey.origin).to.equal("A");
    chai.expect(journey.destination).to.equal("B");
    chai.expect(journey.departureTime).to.equal(1000);
    chai.expect(journey.arrivalTime).to.equal(1030);
  });

  it("calculates the departure time", () => {
    const results = new ScanResults({ A: 1000 }, {});
    const transfers = [
      t("A", "B", 60),
    ];
    const connections = [
      c("B", "C", 1100, 1130)
    ];

    setStopTimes(connections);

    for (const transfer of transfers ) {
      results.setTransfer(transfer);
    }

    for (const connection of connections) {
      results.setConnection(connection);
    }

    const [journey] = factory.getJourneys(results.getConnectionIndex(), ["C"]);

    chai.expect(journey.origin).to.equal("A");
    chai.expect(journey.destination).to.equal("C");
    chai.expect(journey.departureTime).to.equal(1040);
    chai.expect(journey.arrivalTime).to.equal(1130);
  });

  it("calculates the arrival time", () => {
    const results = new ScanResults({ A: 1000 }, {});
    const transfers = [
      t("A", "B", 60),
      t("C", "D", 60),
    ];
    const connections = [
      c("B", "C", 1100, 1130)
    ];

    setStopTimes(connections);

    for (const transfer of transfers ) {
      results.setTransfer(transfer);
    }

    for (const connection of connections) {
      results.setConnection(connection);
    }

    const [journey] = factory.getJourneys(results.getConnectionIndex(), ["D"]);

    chai.expect(journey.origin).to.equal("A");
    chai.expect(journey.destination).to.equal("D");
    chai.expect(journey.departureTime).to.equal(1040);
    chai.expect(journey.arrivalTime).to.equal(1190);
  });

});
