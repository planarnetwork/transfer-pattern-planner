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

    const seed = new JourneySeed(node, [transfer1, transfer2], [timetable1, timetable2]);
    const [legs1, legs2] = seed.getJourneys();

    chai.expect(legs1[0]).to.deep.equal(transfer1);
    chai.expect(legs1[1]).to.deep.equal(transfer2);
    chai.expect(legs1[2]).to.deep.equal(timetable1);
    chai.expect(legs2[0]).to.deep.equal(transfer1);
    chai.expect(legs2[1]).to.deep.equal(transfer2);
    chai.expect(legs2[2]).to.deep.equal(timetable2);
  });

});
