import { describe, expect, it } from "vitest";
import { FrontCoder } from "../../../../src/pattern/format/FrontCoder.js";
import type { PatternPath } from "../../../../src/pattern/format/PatternFormat.js";
import { PatternReader } from "../../../../src/pattern/format/PatternReader.js";

async function read(lines: string[]): Promise<PatternPath[]> {
  const paths: PatternPath[] = [];

  for await (const path of new PatternReader().read(lines)) {
    paths.push(path);
  }

  return paths;
}

/**
 * The stations of each pattern, written and read back, which is what the two halves have to agree
 * on. Sorting is the caller's job, and what the sharing relies on.
 */
async function roundTrip(paths: string[][]): Promise<PatternPath[]> {
  const coder = new FrontCoder();

  return read(paths.map(path => path.join("")).sort().map(line => coder.code(line)));
}

describe("PatternReader", () => {

  it("takes the stations a line does not repeat from the line above it", async () => {
    expect(await read(["0LSTCBGELYNRW", "2NRW", "1NRW"])).toEqual([
      ["LST", "CBG", "ELY", "NRW"],
      ["LST", "CBG", "NRW"],
      ["LST", "NRW"]
    ]);
  });

  it("counts shared stations past nine into the characters above it", async () => {
    const paths = await read(["0AAABBBCCCDDDEEEFFFGGGHHHIIIJJJKKK", ":ZZZ"]);

    // ":" is one past "9", so ten stations are shared
    expect(paths[1]).toEqual(["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG", "HHH", "III", "JJJ", "ZZZ"]);
  });

  it("ignores a blank line, which a file ends with", async () => {
    expect(await read(["0LSTNRW", ""])).toEqual([["LST", "NRW"]]);
  });

  it("reads back every pattern that was written", async () => {
    const paths = [
      ["NRW", "CBG"],
      ["NRW", "CBG", "AAP"],
      ["NRW", "CBG", "BFR"],
      ["NRW", "CBG", "BFR", "HNH", "PNE"],
      ["NRW", "IPS"],
      ["YRK", "LDS", "MAN"]
    ];

    expect(await roundTrip(paths)).toEqual(paths.map(p => p.join("")).sort().map(p => p.match(/.{3}/g)));
  });

  it("keeps a pattern that a longer one runs through", async () => {
    // NRW to BFR is a pattern of its own as well as the start of a longer one, and a tree would
    // need a marker to say so where a line does not
    expect(await roundTrip([["NRW", "CBG", "BFR"], ["NRW", "CBG", "BFR", "HNH", "PNE"]])).toEqual([
      ["NRW", "CBG", "BFR"],
      ["NRW", "CBG", "BFR", "HNH", "PNE"]
    ]);
  });

  it("reads a pattern of more stations than there are digits", async () => {
    const long = ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG", "HHH", "III", "JJJ", "KKK"];

    expect(await roundTrip([long, [...long, "LLL"]])).toEqual([long, [...long, "LLL"]]);
  });

});
