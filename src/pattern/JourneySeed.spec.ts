import * as chai from "chai";
import { JourneySeed } from "./JourneySeed";
import { tr, tt } from "../journey/JourneyFactory.spec";
import { TransferPatternNode } from "./TransferPatternNode";

describe("JourneySeed", () => {

  it("prepends the transfer to every timetable leg", () => {
    const transfer1 = tr("A", "B", 10);
    const transfer2 = tr("B", "C", 10);
    const timetable1 = tt("C", "D", 1000, 1015);
    const timetable2 = tt("C", "D", 1010, 1025);
    const node = new TransferPatternNode([timetable1, timetable2], [], [], 0);

    const seed = new JourneySeed(node, [transfer1, transfer2], [timetable1, timetable2], 0);
    const [legs1, legs2] = seed.getJourneys();

    chai.expect(legs1[0]).to.deep.equal(transfer1);
    chai.expect(legs1[1]).to.deep.equal(transfer2);
    chai.expect(legs1[2]).to.deep.equal(timetable1);
    chai.expect(legs2[0]).to.deep.equal(transfer1);
    chai.expect(legs2[1]).to.deep.equal(transfer2);
    chai.expect(legs2[2]).to.deep.equal(timetable2);
  });

  it("gets journeys from child nodes", () => {
    const transfer1 = tr("A", "B", 10);
    const transfer2 = tr("B", "C", 10);
    const timetable1 = tt("C", "D", 1000, 1015);
    const timetable2 = tt("C", "D", 1010, 1025);
    const timetable3 = tt("D", "E", 1030, 1040);
    const timetable4 = tt("D", "E", 1035, 1045);
    const childNode = new TransferPatternNode([timetable3, timetable4], [], [], 0);
    const node = new TransferPatternNode([timetable1, timetable2], [], [childNode], 10);

    const seed = new JourneySeed(node, [transfer1, transfer2], [timetable1, timetable2], 0);
    const [journey1, journey2] = seed.getJourneys();

    chai.expect(journey1[0]).to.deep.equal(transfer1);
    chai.expect(journey1[1]).to.deep.equal(transfer2);
    chai.expect(journey1[2]).to.deep.equal(timetable1);
    chai.expect(journey1[3]).to.deep.equal(timetable3);
    chai.expect(journey2[0]).to.deep.equal(transfer1);
    chai.expect(journey2[1]).to.deep.equal(transfer2);
    chai.expect(journey2[2]).to.deep.equal(timetable2);
    chai.expect(journey2[3]).to.deep.equal(timetable4);
  });

});
