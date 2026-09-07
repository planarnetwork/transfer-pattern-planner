import { describe, expect, it } from "vitest";
import { isTransfer } from "../../../src/journey/Journey.js";
import { tr, tt } from "../util.js";

describe("isTransfer", () => {

  it("returns true when given a transfer", () => {
    expect(isTransfer(tr("A", "B", 15))).toBe(true);
  });

  it("returns false when given a timetable leg", () => {
    expect(isTransfer(tt("A", "B", 1000, 1015))).toBe(false);
  });

});
