import { describe, expect, it } from "vitest";
import { StopTable } from "../../../../src/gtfs/StopTable.js";
import { NO_NODE } from "../../../../src/pattern/repository/DagNodes.js";
import type { DagRepository } from "../../../../src/pattern/repository/DagRepository.js";
import { DagBuilder } from "../../../../src/pattern/format/DagBuilder.js";
import { at, named, stopsFor } from "../../util.js";

/**
 * The lines as `npm run patterns` writes them, spelled out rather than produced by the code that
 * reads them back:
 *
 *   0LSTCBGELYNRW   the whole pattern, sharing nothing with the line above
 *   2NRW            LST CBG, then NRW      -> LST CBG NRW
 *   1NRW            LST, then NRW          -> LST NRW
 */
const LONDON_TO_NORWICH = ["0LSTCBGELYNRW", "2NRW", "1NRW"];

async function read(lines: string[]): Promise<[DagRepository, StopTable]> {
  const stops = new StopTable();

  return [await new DagBuilder(stops).read(lines), stops];
}

/** A pattern read back as the stations it calls at, ends and all */
function climb(tree: DagRepository, stops: StopTable, node: number): string[] {
  const path: string[] = [];

  for (let n = node; n !== NO_NODE; n = tree.parent[n]) {
    path.push(stops.nameOf(tree.stop[n]));
  }

  return path.reverse();
}

describe("DagBuilder", () => {

  it("holds a stop two patterns share once", async () => {
    const [tree] = await read(LONDON_TO_NORWICH);

    // twelve stations laid out flat, six once the beginnings they share are held once
    expect(tree.stop.length).toBe(6);
  });

  it("hangs the first stop of a pattern off nothing", async () => {
    const [tree, stops] = await read(LONDON_TO_NORWICH);

    expect(tree.parent[0]).toBe(NO_NODE);
    expect(stops.nameOf(tree.stop[0])).toBe("LST");
  });

  it("hangs a line off the node its shared count points at", async () => {
    const [tree, stops] = await read(LONDON_TO_NORWICH);

    // "1NRW" takes LST and adds NRW, so its node hangs off the first
    expect(climb(tree, stops, tree.stop.length - 1)).toEqual(["LST", "NRW"]);
  });

  it("numbers every station it meets in the table it was given", async () => {
    const [, stops] = await read(LONDON_TO_NORWICH);

    expect(stops.names).toEqual(["LST", "CBG", "ELY", "NRW"]);
  });

  it("finds a station the feed numbered first already numbered", async () => {
    // the feed and the patterns are read at the same time against one table, so whichever reaches
    // a station first numbers it and the other has to agree
    const stops = stopsFor("NRW", "LST");
    const tree = await new DagBuilder(stops).read(["0LSTNRW"]);

    expect(stops.names).toEqual(["NRW", "LST"]);
    expect(tree.stop[0]).toBe(at(stops, "LST"));
  });

  it("counts shared stations past nine into the characters above it", async () => {
    const [tree, stops] = await read(["0AAABBBCCCDDDEEEFFFGGGHHHIIIJJJKKK", ":ZZZ"]);

    // ":" is one past "9", so ten stations are shared
    expect(climb(tree, stops, tree.stop.length - 1))
      .toEqual(["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG", "HHH", "III", "JJJ", "ZZZ"]);
  });

  it("ignores a blank line, which a file ends with", async () => {
    const [tree] = await read(["0LSTNRW", ""]);

    expect(tree.stop.length).toBe(2);
  });

  it("files every pattern of a pair under the end the file wrote first", async () => {
    const [tree, stops] = await read(LONDON_TO_NORWICH);

    expect(named(stops, tree.getPatterns(at(stops, "LST"), at(stops, "NRW"))))
      .toEqual([[], ["CBG"], ["CBG", "ELY"]]);
  });

  it("keeps the patterns of each origin apart", async () => {
    const [tree, stops] = await read(["0EUSMAN", "0LSTCBGNRW"]);

    expect(named(stops, tree.getPatterns(at(stops, "EUS"), at(stops, "MAN")))).toEqual([[]]);
    expect(named(stops, tree.getPatterns(at(stops, "LST"), at(stops, "NRW")))).toEqual([["CBG"]]);
    expect(tree.getPatterns(at(stops, "EUS"), at(stops, "NRW"))).toEqual([]);
  });

  it("refuses a file that returns to a station it had left", async () => {
    // only the origin being read is held, so going back to one would drop what was found first
    const failing = new DagBuilder(new StopTable()).read(["0LSTNRW", "0EDBGLQ", "0LSTCBGNRW"]);

    await expect(failing).rejects.toThrow(/returns to a station it had already left/);
  });

});
