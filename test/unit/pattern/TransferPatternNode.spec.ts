import { describe, expect, it } from "vitest";
import { TransferPatternNode } from "../../../src/pattern/TransferPatternNode.js";
import { tr, tt } from "../util.js";

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

    expect(journey1[0]).toEqual(timetable1);
    expect(journey1[1]).toEqual(timetable2);
  });

  it("applies interchange time", () => {
    const child = new TransferPatternNode([timetable2, timetable3], [], [], 1);
    const node = new TransferPatternNode([timetable1], [], [child], 1);

    const [journey1] = node.getJourneys([], 0);

    expect(journey1[0]).toEqual(timetable1);
    expect(journey1[1]).toEqual(timetable3);
  });

  it("finds a transfer", () => {
    const node = new TransferPatternNode([], [transfer1], [], 0);

    const [journey1] = node.getJourneys(
      [timetable1],
      timetable1.stopTimes[timetable1.stopTimes.length - 1].arrivalTime
    );

    expect(journey1[0]).toEqual(timetable1);
    expect(journey1[1]).toEqual(transfer1);
  });

  it("returns a footpath that has not opened yet when it later does", () => {
    const transfer = tr("B", "C", 10, 1000, 1200);
    const node = new TransferPatternNode([], [transfer], [], 0);

    expect(node.findTransfer(900)).toEqual(null);
    expect(node.findTransfer(1100)).toEqual(transfer);
  });

  it("returns a footpath whose window opens after one that has already been used", () => {
    const later = tr("B", "C", 10, 1000, 1200);
    const earlier = tr("B", "C", 15, 600, 900);
    const node = new TransferPatternNode([], [later, earlier], [], 0);

    expect(node.findTransfer(700)).toEqual(earlier);
    expect(node.findTransfer(1100)).toEqual(later);
  });

  it("does not return a footpath whose window has closed", () => {
    const node = new TransferPatternNode([], [tr("B", "C", 10, 600, 900)], [], 0);

    expect(node.findTransfer(1000)).toEqual(null);
  });

  it("asks child nodes to complete the journey", () => {
    const childNode = new TransferPatternNode([timetable4], [], [], 0);
    const node = new TransferPatternNode([timetable2, timetable3], [], [childNode], 0);

    const [journey1] = node.getJourneys(
      [timetable1],
      timetable1.stopTimes[timetable1.stopTimes.length - 1].arrivalTime
    );

    expect(journey1[0]).toEqual(timetable1);
    expect(journey1[1]).toEqual(timetable2);
    expect(journey1[2]).toEqual(timetable4);
  });

});
