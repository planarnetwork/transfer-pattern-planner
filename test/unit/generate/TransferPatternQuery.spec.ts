import { createNetwork } from "raptor-journey-planner";
import { describe, expect, it } from "vitest";
import { StringResults } from "../../../src/generate/StringResults.js";
import { TransferPatternQuery } from "../../../src/generate/TransferPatternQuery.js";
import { feed, st, t, tf } from "./util.js";

const DATE = new Date("2018-10-16");

/**
 * Station codes are three characters wide, as they are in a file, so a line can be read as the
 * stations it names rather than guessed at.
 */
function plan(trips: Parameters<typeof feed>[0], transfers: Parameters<typeof feed>[1] = {}): string[] {
  const query = new TransferPatternQuery(createNetwork(feed(trips, transfers)), () => new StringResults());

  return query.plan("AAA", DATE).sort();
}

describe("TransferPatternQuery", () => {

  it("finds the pattern of a direct journey", () => {
    // a line of two stations is a direct journey, with nothing between its ends
    expect(plan([t(st("AAA", null, 1000), st("BBB", 1100, null))])).toEqual(["AAABBB"]);
  });

  it("records the stop a journey changes at", () => {
    const lines = plan([
      t(st("AAA", null, 1000), st("BBB", 1030, null)),
      t(st("BBB", null, 1100), st("CCC", 1130, null))
    ]);

    // the scan starts at AAA, so it finds what runs from there. BBB to CCC on its own is found by
    // the scan that starts at BBB
    expect(lines).toEqual(["AAABBB", "AAABBBCCC"]);
  });

  it("records the stop a journey transfers at", () => {
    const lines = plan([
      t(st("AAA", null, 1000), st("BBB", 1030, null)),
      t(st("CCC", null, 1100), st("DDD", 1130, null))
    ], { BBB: [tf("BBB", "CCC", 60)] });

    expect(lines).toContain("AAABBBCCCDDD");
  });

  it("keeps scanning the day after a pattern that ends with a transfer", () => {
    const trips = [
      t(st("AAA", null, 1000), st("BBB", 1030, null)),
      // only reachable by starting later, so it is found by a second scan or not at all
      t(st("AAA", null, 1200), st("CCC", 1230, null)),
      t(st("CCC", null, 1300), st("BBB", 1330, null))
    ];

    // a path made only of footpaths, which is where the time the next scan starts from used to
    // come back as NaN and end the day after a single scan
    const lines = plan(trips, { AAA: [tf("AAA", "DDD", 60)] });

    expect(lines).toContain("AAABBB");
    expect(lines).toContain("AAACCCBBB");
  });

  it("finds nothing from an origin the feed has no stop for", () => {
    const network = createNetwork(feed([t(st("AAA", null, 1000), st("BBB", 1100, null))]));
    const query = new TransferPatternQuery(network, () => new StringResults());

    expect(query.plan("ZZZ", DATE)).toEqual([]);
  });

  it("rejects a date the timetable has no calendar for", () => {
    const network = createNetwork(feed([t(st("AAA", null, 1000), st("BBB", 1100, null))]));
    const query = new TransferPatternQuery(network, () => new StringResults());

    expect(() => query.plan("AAA", new Date("2031-04-18")))
      .toThrow(/covers 20180101 to 20201231, so it cannot plan for 20310418/);
  });

});
