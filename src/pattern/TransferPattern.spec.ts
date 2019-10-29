import * as chai from "chai";
import { TransferPattern } from "./TransferPattern";
import { TransferPatternNode } from "./TransferPatternNode";
import { tr, tt } from "../journey/JourneyFactory.spec";

describe("TransferPattern", () => {
  const interchange = { "A": 5, "B": 10, "C": 15 };

  it("will return the journey seeds with transfers until it finds timetable legs", () => {
    const child3 = new TransferPatternNode(
      [tt("C", "D", 1130, 1200)],
      [],
      [],
      10
    );

    const child2 = new TransferPatternNode(
      [],
      [tr("B", "C", 10)],
      [child3],
      10
    );

    const child1 = new TransferPatternNode(
      [],
      [tr("A", "B", 10)],
      [child2],
      10
    );

    const pattern = new TransferPattern("A", [child1], interchange);
    const journeys = pattern.getJourneys({ "A": 10 });

    chai.expect(journeys).to.deep.equal([
      [tr("A", "B", 10), tr("B", "C", 10), tt("C", "D", 1130, 1200)]
    ]);
  });

  it("will call child nodes to complete journeys", () => {
    const child3 = new TransferPatternNode(
      [tt("C", "D", 1130, 1200)],
      [],
      [],
      0
    );

    const child2 = new TransferPatternNode(
      [tt("B", "C", 1100, 1115)],
      [],
      [child3],
      0
    );

    const child1 = new TransferPatternNode(
      [],
      [tr("A", "B", 10)],
      [child2],
      0
    );

    const pattern = new TransferPattern("A", [child1], interchange);
    const journeys = pattern.getJourneys({ "A": 10 });

    chai.expect(journeys).to.deep.equal([
      [tr("A", "B", 10), tt("B", "C", 1100, 1115), tt("C", "D", 1130, 1200)]
    ]);
  });
});
