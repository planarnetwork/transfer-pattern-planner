import * as chai from "chai";
import { pushNested } from "ts-array-utils";
import { TransferRepository } from "./TransferRepository";

describe("TransferRepository", () => {

  it("returns transfers between a given origin and destination", () => {
    const t = { origin: "A", destination: "B", duration: 100 };

    const transferIndex = pushNested(t, {}, t.origin, t.destination);
    const repository = new TransferRepository(transferIndex);
    const [leg] = repository.getTransfers("A", "B");

    chai.expect(leg).to.deep.equal(t);
  });

  it("returns an empty array if transfers can't be found", () => {
    const t = { origin: "A", destination: "B", duration: 100 };

    const transferIndex = pushNested(t, {}, t.origin, t.destination);
    const repository = new TransferRepository(transferIndex);
    const [leg] = repository.getTransfers("A", "C");

    chai.expect(leg).to.be.undefined;
  });

});
