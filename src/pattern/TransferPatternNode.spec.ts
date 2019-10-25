import * as chai from "chai";
import { JourneySeed } from "./JourneySeed";
import { tr, tt } from "../journey/JourneyFactory.spec";
import { TransferPatternNode } from "./TransferPatternNode";

describe("TransferPatternNode", () => {
  const timetable1 = tt("A", "B", 1000, 1015);
  const timetable2 = tt("B", "C", 1015, 1030);
  const timetable3 = tt("B", "C", 1025, 1035);
  const timetable4 = tt("C", "D", 1030, 1040);

  const transfer1 = tr("B", "C", 10);

  it("finds a timetable leg", () => {
    const node = new TransferPatternNode([timetable2, timetable3], [], [], 0);

    const [journey1] = node.getJourneys(
      [timetable1],
      timetable1.stopTimes[timetable1.stopTimes.length - 1].arrivalTime
    );

    chai.expect(journey1[0]).to.deep.equal(timetable1);
    chai.expect(journey1[1]).to.deep.equal(timetable2);
  });

  it("applies interchange time", () => {
    const node = new TransferPatternNode([timetable2, timetable3], [], [], 1);

    const [journey1] = node.getJourneys(
      [timetable1],
      timetable1.stopTimes[timetable1.stopTimes.length - 1].arrivalTime
    );

    chai.expect(journey1[0]).to.deep.equal(timetable1);
    chai.expect(journey1[1]).to.deep.equal(timetable3);
  });

  it("finds a transfer", () => {
    const node = new TransferPatternNode([], [transfer1], [], 0);

    const [journey1] = node.getJourneys(
      [timetable1],
      timetable1.stopTimes[timetable1.stopTimes.length - 1].arrivalTime
    );

    chai.expect(journey1[0]).to.deep.equal(timetable1);
    chai.expect(journey1[1]).to.deep.equal(transfer1);
  });

  it("asks child nodes to complete the journey", () => {
    const childNode = new TransferPatternNode([timetable4], [], [], 0);
    const node = new TransferPatternNode([timetable2, timetable3], [], [childNode], 0);

    const [journey1] = node.getJourneys(
      [timetable1],
      timetable1.stopTimes[timetable1.stopTimes.length - 1].arrivalTime
    );

    chai.expect(journey1[0]).to.deep.equal(timetable1);
    chai.expect(journey1[1]).to.deep.equal(timetable2);
    chai.expect(journey1[2]).to.deep.equal(timetable4);
  });

});
