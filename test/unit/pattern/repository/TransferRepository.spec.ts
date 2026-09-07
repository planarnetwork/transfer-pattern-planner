import { describe, expect, it } from "vitest";
import { TransferRepository } from "../../../../src/pattern/repository/TransferRepository.js";
import { tr } from "../../util.js";

describe("TransferRepository", () => {

  it("returns transfers between a given origin and destination", () => {
    const t = tr("A", "B", 100);

    const repository = new TransferRepository({ A: { B: [t] } });
    const [leg] = repository.getTransfers("A", "B");

    expect(leg).toEqual(t);
  });

  it("returns an empty array if transfers can't be found", () => {
    const t = tr("A", "B", 100);

    const repository = new TransferRepository({ A: { B: [t] } });
    const [leg] = repository.getTransfers("A", "C");

    expect(leg).toBe(undefined);
  });

});
