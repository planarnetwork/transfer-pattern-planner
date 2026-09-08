import { describe, expect, it } from "vitest";
import { checkCodeWidths, sharedStops } from "../../../../src/pattern/format/PatternFormat.js";

describe("sharedStops", () => {

  it("reads the count a line begins with", () => {
    expect(sharedStops("0LSTNRW")).toBe(0);
    expect(sharedStops("2NRW")).toBe(2);
  });

  it("reads a count past nine from the characters above it", () => {
    // ":" is one past "9", and ";" the one after that
    expect(sharedStops(":ZZZ")).toBe(10);
    expect(sharedStops(";ZZZ")).toBe(11);
  });

});

describe("checkCodeWidths", () => {

  it("passes stations a line can be read back with", () => {
    expect(() => checkCodeWidths(["NRW", "LST"])).not.toThrow();
  });

  it("rejects a station code of the wrong width", () => {
    expect(() => checkCodeWidths(["NRW", "PADDINGTON"])).toThrow(/3 character station codes/);
  });

  it("says how many are wrong and names the first of them", () => {
    expect(() => checkCodeWidths(["NRW", "PADDINGTON", "EU"]))
      .toThrow(/2 of 3 are a different length, starting with "PADDINGTON", "EU"/);
  });

});
