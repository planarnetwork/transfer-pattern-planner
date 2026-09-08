import { describe, expect, it } from "vitest";
import { StopTable } from "../../../../src/gtfs/StopTable.js";
import { TransferTreeBuilder } from "../../../../src/pattern/format/TransferTreeBuilder.js";
import type { TransferTree } from "../../../../src/pattern/repository/TransferTree.js";
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

async function read(lines: string[]): Promise<[TransferTree, StopTable]> {
  const stops = new StopTable();

  return [await new TransferTreeBuilder(stops).read(lines), stops];
}

/** The patterns between two stations, named, so an expectation can say what it means */
async function between(lines: string[], origin: string, destination: string): Promise<string[][]> {
  const [tree, stops] = await read(lines);

  return named(stops, tree.getPatterns(at(stops, origin), at(stops, destination)));
}

describe("TransferTreeBuilder", () => {

  it("holds a stop two patterns share once", async () => {
    const [tree] = await read(LONDON_TO_NORWICH);

    // twelve stations laid out flat, six once the beginnings they share are held once
    expect(tree.nodes).toBe(6);
  });

  it("reads every pattern of a line back out", async () => {
    expect(await between(LONDON_TO_NORWICH, "LST", "NRW")).toEqual([[], ["CBG"], ["CBG", "ELY"]]);
  });

  it("takes the stations a line does not repeat from the line above it", async () => {
    // "2NRW" takes LST CBG and adds NRW, "1NRW" takes LST alone
    expect(await between(LONDON_TO_NORWICH, "LST", "NRW")).toContainEqual(["CBG"]);
    expect(await between(LONDON_TO_NORWICH, "LST", "NRW")).toContainEqual([]);
  });

  it("numbers every station it meets in the table it was given", async () => {
    const [, stops] = await read(LONDON_TO_NORWICH);

    expect(stops.names).toEqual(["LST", "CBG", "ELY", "NRW"]);
  });

  it("finds a station the feed numbered first already numbered", async () => {
    // the feed and the patterns are read at the same time against one table, so whichever reaches
    // a station first numbers it and the other has to agree
    const stops = stopsFor("NRW", "LST");
    const tree = await new TransferTreeBuilder(stops).read(["0LSTNRW"]);

    expect(stops.names).toEqual(["NRW", "LST"]);
    expect(tree.getPatterns(at(stops, "LST"), at(stops, "NRW"))).toEqual([[]]);
  });

  it("counts shared stations past nine into the characters above it", async () => {
    // ":" is one past "9", so ten stations are shared
    const lines = ["0AAABBBCCCDDDEEEFFFGGGHHHIIIJJJKKK", ":ZZZ"];

    expect(await between(lines, "AAA", "ZZZ"))
      .toEqual([["BBB", "CCC", "DDD", "EEE", "FFF", "GGG", "HHH", "III", "JJJ"]]);
  });

  it("ignores a blank line, which a file ends with", async () => {
    const [tree] = await read(["0LSTNRW", ""]);

    expect(tree.nodes).toBe(2);
  });

  it("keeps the patterns of each origin apart", async () => {
    const [tree, stops] = await read(["0EUSMAN", "0LSTCBGNRW"]);

    expect(named(stops, tree.getPatterns(at(stops, "EUS"), at(stops, "MAN")))).toEqual([[]]);
    expect(named(stops, tree.getPatterns(at(stops, "LST"), at(stops, "NRW")))).toEqual([["CBG"]]);
    expect(tree.getPatterns(at(stops, "EUS"), at(stops, "NRW"))).toEqual([]);
  });

  it("refuses a file that returns to a station it had left", async () => {
    // only the origin being read is held, so going back to one would drop what was found first
    const failing = new TransferTreeBuilder(new StopTable()).read(["0LSTNRW", "0EDBGLQ", "0LSTCBGNRW"]);

    await expect(failing).rejects.toThrow(/returns to a station it had already left/);
  });

});
