import { describe, expect, it } from "vitest";
import {
  NO_NODE, type PatternTree, patternsBetween, readPatternTree
} from "../../../../src/pattern/repository/PatternTree.js";
import { type StopTable, stopTable } from "../../../../src/StopTable.js";
import { at, named, stopsFor } from "../../util.js";

/**
 * The lines below are the file as `npm run patterns` writes it, spelled out rather than produced by
 * the code that reads them back.
 *
 *   0LSTCBGELYNRW   the whole pattern, sharing nothing with the line above
 *   2NRW            LST CBG, then NRW      -> LST CBG NRW
 *   1NRW            LST, then NRW          -> LST NRW
 */
const LONDON_TO_NORWICH = ["0LSTCBGELYNRW", "2NRW", "1NRW"];

async function read(lines: string[]): Promise<[PatternTree, StopTable]> {
  const stops = stopTable();

  return [await readPatternTree(lines, stops), stops];
}

/**
 * A pattern read back as the stations it calls at, ends and all, for looking at the tree itself
 * rather than at what a query asks of it.
 */
function climb(tree: PatternTree, stops: StopTable, node: number): string[] {
  const path: string[] = [];

  for (let n = node; n !== NO_NODE; n = tree.parent[n]) {
    path.push(stops.stopIds[tree.stop[n]]);
  }

  return path.reverse();
}

describe("readPatternTree", () => {

  it("holds a stop two patterns share once", async () => {
    const [tree] = await read(LONDON_TO_NORWICH);

    // LST CBG ELY NRW, LST CBG NRW and LST NRW are twelve stations laid out flat, and six once
    // the beginnings they share are held once
    expect(tree.stop.length).toBe(6);
    expect(tree.parent.length).toBe(6);
  });

  it("hangs the first stop of a pattern off nothing", async () => {
    const [tree, stops] = await read(LONDON_TO_NORWICH);

    expect(tree.parent[0]).toBe(NO_NODE);
    expect(stops.stopIds[tree.stop[0]]).toBe("LST");
  });

  it("names a pattern by the node it ends on", async () => {
    const [tree, stops] = await read(LONDON_TO_NORWICH);
    const ends = tree.from[at(stops, "LST")]?.get(at(stops, "NRW")) ?? [];

    expect(ends.map(node => climb(tree, stops, node))).toEqual([
      ["LST", "CBG", "ELY", "NRW"],
      ["LST", "CBG", "NRW"],
      ["LST", "NRW"]
    ]);
  });

  it("files the patterns of a pair under the end the file wrote first", async () => {
    const [tree, stops] = await read(LONDON_TO_NORWICH);

    expect(tree.from[at(stops, "NRW")]).toBe(undefined);
  });

  it("numbers every station it meets in the table it was given", async () => {
    const [, stops] = await read(LONDON_TO_NORWICH);

    expect(stops.stopIds).toEqual(["LST", "CBG", "ELY", "NRW"]);
  });

  it("finds a station the feed numbered first already numbered", async () => {
    // the feed and the patterns are read at the same time against one table, so whichever reaches
    // a station first numbers it and the other has to agree
    const stops = stopsFor("NRW", "LST");
    const tree = await readPatternTree(["0LSTNRW"], stops);

    expect(stops.stopIds).toEqual(["NRW", "LST"]);
    expect(tree.stop[0]).toBe(at(stops, "LST"));
  });

  it("counts shared stations past nine into the characters above it", async () => {
    // ":" is one past "9", so ten stations are shared
    const [tree, stops] = await read(["0AAABBBCCCDDDEEEFFFGGGHHHIIIJJJKKK", ":ZZZ"]);
    const [end] = tree.from[at(stops, "AAA")]?.get(at(stops, "ZZZ")) ?? [];

    expect(climb(tree, stops, end))
      .toEqual(["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG", "HHH", "III", "JJJ", "ZZZ"]);
  });

  it("ignores a blank line, which a file ends with", async () => {
    const [tree] = await read(["0LSTNRW", ""]);

    expect(tree.stop.length).toBe(2);
  });

});

describe("patternsBetween", () => {

  async function between(lines: string[], origin: string, destination: string) {
    const [tree, stops] = await read(lines);

    return named(stops, patternsBetween(tree, at(stops, origin), at(stops, destination)));
  }

  it("returns the stations between the ends, shortest pattern first", async () => {
    expect(await between(LONDON_TO_NORWICH, "LST", "NRW")).toEqual([[], ["CBG"], ["CBG", "ELY"]]);
  });

  it("reads a pattern backwards for a journey the other way round", async () => {
    expect(await between(LONDON_TO_NORWICH, "NRW", "LST")).toEqual([[], ["CBG"], ["ELY", "CBG"]]);
  });

  it("reads a direct pattern as no stations between the ends", async () => {
    expect(await between(["0LSTNRW"], "LST", "NRW")).toEqual([[]]);
  });

  it("gives nothing for a pair it holds no pattern for", async () => {
    expect(await between(["0LSTNRW", "0EDBLST"], "NRW", "EDB")).toEqual([]);
  });

});
