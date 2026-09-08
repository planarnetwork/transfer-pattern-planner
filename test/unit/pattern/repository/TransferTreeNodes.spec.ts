import { describe, expect, it } from "vitest";
import { NO_NODE, TransferTreeNodes } from "../../../../src/pattern/repository/TransferTreeNodes.js";

describe("TransferTreeNodes", () => {

  it("numbers the nodes as they are added", () => {
    const nodes = new TransferTreeNodes();

    expect(nodes.add(7, NO_NODE)).toBe(0);
    expect(nodes.add(8, 0)).toBe(1);
    expect(nodes.size).toBe(2);
  });

  it("holds the stop and the node before it", () => {
    const nodes = new TransferTreeNodes();
    const first = nodes.add(7, NO_NODE);
    const second = nodes.add(8, first);

    expect(nodes.stopAt(second)).toBe(8);
    expect(nodes.stopColumn()).toEqual(Uint16Array.from([7, 8]));
    expect(nodes.parentColumn()).toEqual(Int32Array.from([NO_NODE, 0]));
  });

  it("cuts the columns down to the nodes that were added", () => {
    const nodes = new TransferTreeNodes();

    nodes.add(7, NO_NODE);

    expect(nodes.stopColumn().length).toBe(1);
    expect(nodes.parentColumn().length).toBe(1);
  });

  it("keeps every node once it has grown past the room it started with", () => {
    const nodes = new TransferTreeNodes();

    // more than the 1024 it starts with, so the columns are doubled at least once
    for (let i = 0; i < 5000; i++) {
      nodes.add(i % 2789, i === 0 ? NO_NODE : i - 1);
    }

    expect(nodes.size).toBe(5000);
    expect(nodes.stopAt(4999)).toBe(4999 % 2789);
    expect(nodes.parentColumn()[4999]).toBe(4998);
    expect(nodes.stopColumn().length).toBe(5000);
  });

});
