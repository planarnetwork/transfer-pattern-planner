import type { StopIdx } from "../../gtfs/StopTable.js";

/** The parent of a node that starts a pattern */
export const NO_NODE = -1;

/** Nodes to start with room for, doubling from there */
const INITIAL = 1024;

/**
 * The stop and the node before it, for every node of a tree, held as a column each.
 *
 * Typed arrays cannot grow, so these double as they fill: collecting into ordinary arrays and
 * converting at the end would hold both at once, costing more than the columns save.
 */
export class TransferTreeNodes {

  private stops = new Uint16Array(INITIAL);
  private parents = new Int32Array(INITIAL);
  private length = 0;

  /** Add a node and return it */
  public add(stop: StopIdx, parent: number): number {
    if (this.length === this.parents.length) {
      this.grow();
    }

    this.stops[this.length] = stop;
    this.parents[this.length] = parent;

    return this.length++;
  }

  public stopAt(node: number): StopIdx {
    return this.stops[node];
  }

  public get size(): number {
    return this.length;
  }

  /** Cut down to the nodes that were added */
  public stopColumn(): Uint16Array {
    return this.stops.slice(0, this.length);
  }

  public parentColumn(): Int32Array {
    return this.parents.slice(0, this.length);
  }

  private grow(): void {
    const stops = new Uint16Array(this.length * 2);
    const parents = new Int32Array(this.length * 2);

    stops.set(this.stops);
    parents.set(this.parents);

    this.stops = stops;
    this.parents = parents;
  }

}
