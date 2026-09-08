import { describe, expect, it } from "vitest";
import {
  checkCodeWidths, frontCode, type PatternsByEnds, patternLines, readPatterns
} from "../../../../src/pattern/repository/PatternFormat.js";

function lines(patterns: PatternsByEnds): string[] {
  return [...patternLines(patterns)];
}

/**
 * Everything the format does, in the order a file goes through it: named, sorted, front coded, and
 * read back. Both halves live here now, so this is the one test that can say they agree.
 */
async function roundTrip(paths: string[][]): Promise<string[][]> {
  const sorted = paths.map(path => path.join("")).sort();
  const out: string[][] = [];

  for await (const path of readPatterns([...frontCode(sorted)])) {
    out.push(path);
  }

  return out;
}

describe("PatternFormat", () => {

  it("writes a pattern as the stations it calls at", () => {
    expect(lines({ NRWLST: new Set(["", "CBG", "CBG,BFR"]) }))
      .toEqual(["NRWLST", "NRWCBGLST", "NRWCBGBFRLST"]);
  });

  it("takes the leading stations a line shares with the one before it", () => {
    const sorted = ["NRWCBG", "NRWCBGAAP", "NRWCBGBFR", "NRWCBGBFRHNHPNE", "NRWCBGBFRHNHSYH"];

    expect([...frontCode(sorted)]).toEqual(["0NRWCBG", "2AAP", "2BFR", "3HNHPNE", "4SYH"]);
  });

  it("reads back what it wrote", async () => {
    const paths = [
      ["NRW", "CBG"],
      ["NRW", "CBG", "AAP"],
      ["NRW", "CBG", "BFR"],
      ["NRW", "CBG", "BFR", "HNH", "PNE"],
      ["NRW", "CBG", "BFR", "NWD", "PNW", "PNE"],
      ["NRW", "IPS"],
      ["YRK", "LDS", "MAN"]
    ];

    expect(await roundTrip(paths)).toEqual(paths.map(p => p.join("")).sort().map(p => p.match(/.{3}/g)));
  });

  it("reads back a whole set of patterns as it was written", async () => {
    const patterns: PatternsByEnds = {
      LSTNRW: new Set(["", "CBG", "CBG,ELY"]),
      BHMEDB: new Set(["", "NCL"])
    };

    const out: string[][] = [];

    for await (const path of readPatterns([...frontCode(lines(patterns).sort())])) {
      out.push(path);
    }

    expect(out).toEqual([
      ["BHM", "EDB"],
      ["BHM", "NCL", "EDB"],
      ["LST", "CBG", "ELY", "NRW"],
      ["LST", "CBG", "NRW"],
      ["LST", "NRW"]
    ]);
  });

  it("keeps a pattern that a longer one runs through", async () => {
    // NRW to BFR is a pattern of its own as well as the start of a longer one, and a tree would
    // need a marker to say so where a line does not
    const paths = [["NRW", "CBG", "BFR"], ["NRW", "CBG", "BFR", "HNH", "PNE"]];

    expect(await roundTrip(paths)).toEqual([
      ["NRW", "CBG", "BFR"],
      ["NRW", "CBG", "BFR", "HNH", "PNE"]
    ]);
  });

  it("handles a pattern that shares nothing with the one before it", async () => {
    expect(await roundTrip([["AAA", "BBB"], ["CCC", "DDD"]])).toEqual([["AAA", "BBB"], ["CCC", "DDD"]]);
  });

  it("handles more shared stations than there are digits", async () => {
    const long = ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG", "HHH", "III", "JJJ", "KKK"];

    expect(await roundTrip([long, [...long, "LLL"]])).toEqual([long, [...long, "LLL"]]);
  });

  it("rejects a station code of the wrong width", () => {
    expect(() => checkCodeWidths(["NRW", "LST"])).not.toThrow();
    expect(() => checkCodeWidths(["NRW", "PADDINGTON"])).toThrow(/3 character station codes/);
  });

});
