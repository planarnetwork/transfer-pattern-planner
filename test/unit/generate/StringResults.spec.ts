import type { StopID } from "@gb-transit/gtfs-loader";
import type { ConnectionIndex, Network } from "raptor-journey-planner";
import { describe, expect, it } from "vitest";
import { StringResults } from "../../../src/generate/StringResults.js";

/**
 * Station codes are three characters wide, as they are in a file, so a line can be read as the
 * stations it names rather than guessed at.
 */
describe("StringResults", () => {

  it("writes a line for every pattern a path runs through", () => {
    const results = new StringResults();

    mergePath(["AAA", "BBB", "CCC", "DDD"], results);

    expect(results.lines().sort()).toEqual(["AAABBB", "AAABBBCCC", "AAABBBCCCDDD"]);
  });

  it("writes a pattern found twice only once", () => {
    const results = new StringResults();

    mergePath(["AAA", "BBB", "CCC", "DDD"], results);
    mergePath(["AAA", "BBB", "CCC"], results);

    expect(results.lines().sort()).toEqual(["AAABBB", "AAABBBCCC", "AAABBBCCCDDD"]);
  });

  it("writes the two ends of a pattern in order, whichever way it was travelled", () => {
    const results = new StringResults();

    // travelled from CCC, so every line still begins with the earlier of its two ends
    mergePath(["CCC", "BBB", "AAA"], results);

    expect(results.lines().sort()).toEqual(["AAABBBCCC", "BBBCCC"]);
  });

  it("keeps a pattern that another pattern runs through", () => {
    const results = new StringResults();

    mergePath(["AAA", "BBB", "DDD"], results);
    mergePath(["AAA", "BBB", "CCC", "DDD"], results);

    // changing at BBB and changing at BBB then CCC are both ways of getting from AAA to DDD
    expect(results.lines().filter(line => line.startsWith("AAA") && line.endsWith("DDD")).sort())
      .toEqual(["AAABBBCCCDDD", "AAABBBDDD"]);
  });

  it("writes two ways round the same pair as two patterns", () => {
    const results = new StringResults();

    mergePath(["AAA", "BBB", "CCC", "DDD"], results);
    mergePath(["AAA", "CCC", "BBB", "DDD"], results);

    expect(results.lines().filter(line => line.endsWith("DDD")).sort())
      .toEqual(["AAABBBCCCDDD", "AAACCCBBBDDD"]);
  });

  it("finds nothing in a scan that reached nowhere", () => {
    expect(new StringResults().lines()).toEqual([]);
  });

});

/**
 * A path as the scan leaves it: each step is a route of its own with one trip, boarded at position
 * 0 and alighted at position 1, departing at the step's number.
 */
function mergePath(path: StopID[], tree: StringResults): void {
  const kConnections: ConnectionIndex = [];
  const stopIds: StopID[] = [];
  const stopIndex = new Map<StopID, number>();
  const routeStops: number[] = [];

  const intern = (stop: StopID): number => {
    let index = stopIndex.get(stop);

    if (index === undefined) {
      index = stopIds.length;
      stopIndex.set(stop, index);
      stopIds.push(stop);
    }

    return index;
  };

  const stopTimesBase: number[] = [];
  const tripOffsets: number[] = [];
  const departures: number[] = [];

  for (let i = 1; i < path.length; i++) {
    const route = i - 1;

    routeStops.push(intern(path[i - 1]), intern(path[i]));
    kConnections[intern(path[i])] = [];
    kConnections[intern(path[i])][i] = [route, route, 0, 1];
    stopTimesBase.push(route * 2);
    tripOffsets.push(route);
    departures.push(i, i);
  }

  // every stop needs a slot, including any the path only starts from
  for (let stop = 0; stop < stopIds.length; stop++) {
    kConnections[stop] = kConnections[stop] ?? [];
  }

  const network = {
    timetable: {
      routes: {
        stopOffsets: Int32Array.from({ length: path.length }, (_, route) => route * 2),
        stops: Int32Array.from(routeStops),
        stopTimesBase: Int32Array.from(stopTimesBase),
        tripOffsets: Int32Array.from(tripOffsets),
        departures: Int32Array.from(departures)
      },
      interchange: new Int32Array(stopIds.length)
    },
    stopIds,
    stopIndex,
    transfers: []
  } as unknown as Network;

  tree.add(kConnections, network);
}
