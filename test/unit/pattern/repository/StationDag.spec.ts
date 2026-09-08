import { describe, expect, it } from "vitest";
import { StationDag } from "../../../../src/pattern/repository/StationDag.js";

function from(patterns: Record<number, number[]>): StationDag {
  return new StationDag(new Map(Object.entries(patterns).map(([stop, nodes]) => [Number(stop), nodes])));
}

function endsAt(patterns: StationDag, destination: number): number[] | undefined {
  const ends = patterns.endsAt(destination);

  return ends && [...ends];
}

describe("StationDag", () => {

  it("gives back the patterns to each destination", () => {
    const patterns = from({ 5: [10, 11], 9: [12] });

    expect(endsAt(patterns, 5)).toEqual([10, 11]);
    expect(endsAt(patterns, 9)).toEqual([12]);
  });

  it("gives nothing for a destination it holds no pattern to", () => {
    expect(endsAt(from({ 5: [10] }), 9)).toBe(undefined);
  });

  it("gives nothing for a destination between two it does hold", () => {
    // the destinations are searched rather than scanned, so a miss in the middle has to land
    expect(endsAt(from({ 1: [10], 9: [11] }), 5)).toBe(undefined);
  });

  it("gives nothing for a destination past either end of what it holds", () => {
    const patterns = from({ 3: [10], 5: [11] });

    expect(endsAt(patterns, 1)).toBe(undefined);
    expect(endsAt(patterns, 9)).toBe(undefined);
  });

  it("finds a destination wherever it falls among the others", () => {
    const destinations = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
    const patterns = from(Object.fromEntries(destinations.map(d => [d, [d * 10]])));

    for (const destination of destinations) {
      expect(endsAt(patterns, destination)).toEqual([destination * 10]);
      expect(endsAt(patterns, destination + 1)).toBe(undefined);
    }
  });

  it("takes the destinations in any order and searches them in order", () => {
    const patterns = from({ 9: [12], 1: [10], 5: [11] });

    expect(endsAt(patterns, 1)).toEqual([10]);
    expect(endsAt(patterns, 5)).toEqual([11]);
    expect(endsAt(patterns, 9)).toEqual([12]);
  });

  it("holds an origin that reaches nowhere", () => {
    expect(endsAt(from({}), 1)).toBe(undefined);
  });

});
