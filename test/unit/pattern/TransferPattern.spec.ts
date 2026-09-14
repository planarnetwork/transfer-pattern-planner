import { describe, expect, it } from "vitest";
import { TransferPattern } from "../../../src/pattern/TransferPattern.js";
import { TransferPatternNode } from "../../../src/pattern/TransferPatternNode.js";
import { at, stopsFor, tr, tt } from "../util.js";

describe("TransferPattern", () => {
  // every leg of a node arrives at the station the node is, so a node carries the interchange time
  // of its own station: child1 is B, child2 is C, child3 is D
  const stops = stopsFor("A", "B", "C", "D");

  it("will return the journey seeds with transfers until it finds timetable legs", () => {
    const child3 = new TransferPatternNode(
      [tt("C", "D", 1130, 1200)],
      [],
      [],
      20
    );

    const child2 = new TransferPatternNode(
      [],
      [tr("B", "C", 10)],
      [child3],
      15
    );

    const child1 = new TransferPatternNode(
      [],
      [tr("A", "B", 10)],
      [child2],
      10
    );

    const pattern = new TransferPattern(at(stops, "A"), [child1]);
    const journeys = pattern.getJourneys(new Map([[at(stops, "A"), 10]]));

    expect(journeys).toEqual([
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

    const pattern = new TransferPattern(at(stops, "A"), [child1]);
    const journeys = pattern.getJourneys(new Map([[at(stops, "A"), 10]]));

    expect(journeys).toEqual([
      [tr("A", "B", 10), tt("B", "C", 1100, 1115), tt("C", "D", 1130, 1200)]
    ]);
  });

  it("will use a footpath on a branch that reaches it inside its window, having tried one that does not", () => {
    const child3 = new TransferPatternNode(
      [tt("C", "D", 1130, 1200)],
      [],
      [],
      20
    );

    // both branches ask this node for the same footpath, the first of them before its window opens
    const child2 = new TransferPatternNode(
      [],
      [tr("B", "C", 10, 1000, 1200)],
      [child3],
      15
    );

    const walk = new TransferPatternNode([], [tr("A", "B", 10)], [child2], 10);
    const amble = new TransferPatternNode([], [tr("A", "B", 1000)], [child2], 10);

    const pattern = new TransferPattern(at(stops, "A"), [walk, amble]);
    const journeys = pattern.getJourneys(new Map([[at(stops, "A"), 10]]));

    expect(journeys).toEqual([
      [tr("A", "B", 1000), tr("B", "C", 10, 1000, 1200), tt("C", "D", 1130, 1200)]
    ]);
  });

  it("walks from the origin where it reaches the next station before the first timetable leg", () => {
    const child2 = new TransferPatternNode([tt("B", "C", 100, 150), tt("B", "C", 2400, 2450)], [], [], 0);
    const child1 = new TransferPatternNode([tt("A", "B", 2300, 2310)], [tr("A", "B", 60)], [child2], 0);

    const pattern = new TransferPattern(at(stops, "A"), [child1]);
    const journeys = pattern.getJourneys(new Map([[at(stops, "A"), 10]]));

    // after a walk every later leg is a journey too, as it is after any footpath from the origin
    expect(journeys).toEqual([
      [tr("A", "B", 60), tt("B", "C", 100, 150)],
      [tr("A", "B", 60), tt("B", "C", 2400, 2450)],
      [tt("A", "B", 2300, 2310), tt("B", "C", 2400, 2450)]
    ]);
  });

  it("does not walk from the origin where a timetable leg reaches the next station first", () => {
    const child2 = new TransferPatternNode([tt("B", "C", 100, 150)], [], [], 0);
    const child1 = new TransferPatternNode([tt("A", "B", 20, 30)], [tr("A", "B", 60)], [child2], 0);

    const pattern = new TransferPattern(at(stops, "A"), [child1]);
    const journeys = pattern.getJourneys(new Map([[at(stops, "A"), 10]]));

    expect(journeys).toEqual([[tt("A", "B", 20, 30), tt("B", "C", 100, 150)]]);
  });

});
