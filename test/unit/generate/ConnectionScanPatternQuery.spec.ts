import { toGtfsData } from "connection-scan-algorithm";
import { describe, expect, it } from "vitest";
import { ConnectionScanPatternQuery } from "../../../src/generate/ConnectionScanPatternQuery.js";
import { readSharedTimetable, shareTimetable } from "../../../src/generate/SharedTimetable.js";
import { feed, st, t, tf } from "./util.js";

const DATE = new Date("2018-10-16");

function query(
  trips: Parameters<typeof feed>[0],
  transfers: Parameters<typeof feed>[1] = {},
  interchange: Parameters<typeof feed>[2] = {}
): ConnectionScanPatternQuery {
  return new ConnectionScanPatternQuery(toGtfsData(feed(trips, transfers, interchange)));
}

function plan(trips: Parameters<typeof feed>[0], transfers: Parameters<typeof feed>[1] = {}): string[] {
  return query(trips, transfers).plan("AAA", DATE).sort();
}

describe("ConnectionScanPatternQuery", () => {

  it("finds the pattern of a direct journey", () => {
    expect(plan([t(st("AAA", null, 1000), st("BBB", 1100, null))])).toEqual(["AAABBB"]);
  });

  it("records the stop a journey changes at", () => {
    const lines = plan([
      t(st("AAA", null, 1000), st("BBB", 1030, null)),
      t(st("BBB", null, 1100), st("CCC", 1130, null))
    ]);

    expect(lines).toEqual(["AAABBB", "AAABBBCCC"]);
  });

  it("records the stop a journey transfers at", () => {
    const lines = plan([
      t(st("AAA", null, 1000), st("BBB", 1030, null)),
      t(st("CCC", null, 1100), st("DDD", 1130, null))
    ], { BBB: [tf("BBB", "CCC", 60)] });

    expect(lines).toContain("AAABBBCCCDDD");
  });

  it("finds a later journey that arrives sooner", () => {
    const lines = plan([
      t(st("AAA", null, 1000), st("BBB", 1030, null)),
      t(st("BBB", null, 1100), st("CCC", 1300, null)),
      // the direct train leaves after the first journey, so only a scan starting later finds it
      t(st("AAA", null, 1010), st("CCC", 1200, null))
    ]);

    expect(lines).toEqual(["AAABBB", "AAACCC"]);
  });

  it("finds a journey arriving later in fewer legs alongside the earliest arrival", () => {
    const lines = plan([
      t(st("AAA", null, 1000), st("BBB", 1030, null)),
      t(st("BBB", null, 1040), st("CCC", 1100, null)),
      // leaves at the same time as the journey above, so no later scan finds it on its own
      t(st("AAA", null, 1000), st("CCC", 1200, null))
    ]);

    expect(lines).toEqual(["AAABBB", "AAABBBCCC", "AAACCC"]);
  });

  it("does not change onto a trip that could have been boarded where the journey began", () => {
    const lines = plan([
      t(st("AAA", null, 1000), st("BBB", 1010, null)),
      // reaches BBB after the train above, but the passenger is aboard it from AAA all the same
      t(st("AAA", null, 1005), st("BBB", 1015, 1020), st("CCC", 1030, null))
    ]);

    expect(lines).toEqual(["AAABBB", "AAACCC"]);
  });

  it("boards a trip where the passenger reached it, not where its connection departs", () => {
    const trips = [
      t(st("AAA", null, 1000), st("BBB", 1100, null)),
      // reaches DDD first, so the scan keeps it as the way to DDD
      t(st("AAA", null, 1050), st("DDD", 1125, null)),
      // boarded at BBB. Changing onto it at DDD would take longer than the interchange there allows
      t(st("BBB", null, 1110), st("DDD", 1130, 1130), st("EEE", 1150, null))
    ];

    const lines = query(trips, {}, { DDD: 600 }).plan("AAA", DATE).sort();

    expect(lines).toEqual(["AAABBB", "AAABBBEEE", "AAADDD"]);
  });

  it("changes at the first call two trips share rather than riding past it and back", () => {
    const lines = plan([
      // reaches BBB first, in two legs, so the scan counts BBB as two legs away
      t(st("AAA", null, 1000), st("XXX", 1002, null)),
      t(st("XXX", null, 1003), st("BBB", 1005, null)),
      // passes BBB in one leg, and the trip below is boarded at CCC, reached in one leg too
      t(st("AAA", null, 1000), st("BBB", 1010, 1010), st("CCC", 1020, null)),
      t(st("CCC", null, 1030), st("BBB", 1040, 1040), st("DDD", 1050, null))
    ]);

    expect(lines).not.toContain("AAACCCDDD");
    expect(lines).toContain("AAABBBDDD");
  });

  it("keeps scanning the day after a pattern that ends with a transfer", () => {
    const trips = [
      t(st("AAA", null, 1000), st("BBB", 1030, null)),
      t(st("AAA", null, 1200), st("CCC", 1230, null)),
      t(st("CCC", null, 1300), st("BBB", 1330, null))
    ];

    const lines = plan(trips, { AAA: [tf("AAA", "DDD", 60)] });

    expect(lines).toContain("AAABBB");
    expect(lines).toContain("AAACCCBBB");
  });

  it("finds nothing from an origin the feed has no stop for", () => {
    expect(query([t(st("AAA", null, 1000), st("BBB", 1100, null))]).plan("ZZZ", DATE)).toEqual([]);
  });

  it("finds the same patterns from a timetable shared with a worker", () => {
    const gtfs = toGtfsData(feed([
      t(st("AAA", null, 1000), st("BBB", 1030, null)),
      t(st("BBB", null, 1100), st("CCC", 1130, null)),
      t(st("CCC", null, 1000), st("DDD", 1130, null))
    ], { BBB: [tf("BBB", "DDD", 60)] }));

    const shared = readSharedTimetable(shareTimetable(gtfs, DATE));
    const fromShared = new ConnectionScanPatternQuery(shared);
    const fromFeed = new ConnectionScanPatternQuery(gtfs);

    expect(fromShared.plan("AAA", DATE).sort()).toEqual(fromFeed.plan("AAA", DATE).sort());
  });

});
