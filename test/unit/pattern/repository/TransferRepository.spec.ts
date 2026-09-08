import { describe, expect, it } from "vitest";
import { TransferRepository } from "../../../../src/pattern/repository/TransferRepository.js";
import { at, between, stopsFor, tr } from "../../util.js";

describe("TransferRepository", () => {

  it("returns transfers between a given origin and destination", () => {
    const t = tr("A", "B", 100);
    const stops = stopsFor("A", "B", "C");

    const repository = new TransferRepository(between(stops, [["A", "B", [t]]]));
    const [leg] = repository.getTransfers(at(stops, "A"), at(stops, "B"));

    expect(leg).toEqual(t);
  });

  it("returns an empty array if transfers can't be found", () => {
    const t = tr("A", "B", 100);
    const stops = stopsFor("A", "B", "C");

    const repository = new TransferRepository(between(stops, [["A", "B", [t]]]));
    const [leg] = repository.getTransfers(at(stops, "A"), at(stops, "C"));

    expect(leg).toBe(undefined);
  });

});
