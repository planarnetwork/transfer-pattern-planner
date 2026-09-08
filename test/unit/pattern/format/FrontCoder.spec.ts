import { describe, expect, it } from "vitest";
import { FrontCoder } from "../../../../src/pattern/format/FrontCoder.js";

function code(lines: string[]): string[] {
  const coder = new FrontCoder();

  return lines.map(line => coder.code(line));
}

describe("FrontCoder", () => {

  it("writes the first line whole, since it shares nothing", () => {
    expect(code(["NRWCBG"])).toEqual(["0NRWCBG"]);
  });

  it("takes the leading stations a line shares with the one before it", () => {
    expect(code(["NRWCBG", "NRWCBGAAP", "NRWCBGBFR", "NRWCBGBFRHNHPNE", "NRWCBGBFRHNHSYH"]))
      .toEqual(["0NRWCBG", "2AAP", "2BFR", "3HNHPNE", "4SYH"]);
  });

  it("shares nothing with a line that begins differently", () => {
    expect(code(["AAABBB", "CCCDDD"])).toEqual(["0AAABBB", "0CCCDDD"]);
  });

  it("counts whole stations, not characters they happen to begin with", () => {
    // NRW and NRX share two characters, which is no station at all
    expect(code(["NRWCBG", "NRXCBG"])).toEqual(["0NRWCBG", "0NRXCBG"]);
  });

  it("counts past nine into the characters above it", () => {
    const long = "AAABBBCCCDDDEEEFFFGGGHHHIIIJJJ";

    // ":" is one past "9", so ten stations are shared
    expect(code([long, `${long}ZZZ`])).toEqual([`0${long}`, ":ZZZ"]);
  });

  it("starts a run of its own, so a new coder shares nothing", () => {
    const coder = new FrontCoder();

    expect(coder.code("NRWCBG")).toBe("0NRWCBG");
    expect(new FrontCoder().code("NRWCBGAAP")).toBe("0NRWCBGAAP");
  });

});
