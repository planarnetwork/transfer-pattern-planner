import type { StopIdx, StopTable } from "../../gtfs/StopTable.js";
import { CODE_WIDTH, sharedStops } from "./PatternFormat.js";

/** The parent of a node that starts a pattern, so there is nothing before it */
export const NO_NODE = -1;

/** Nodes a tree starts with room for, doubling from there as the file is read */
const INITIAL_NODES = 1024;

/**
 * Every pattern in a file, holding each stop it shares with another pattern once.
 *
 * A file is sorted, so patterns beginning the same way sit together and a line only records what it
 * adds to the line above it. That is a tree, and this is it held as one rather than flattened into a
 * string per pattern: a national feed holds 34 million patterns of five stops each, which is 187
 * million stops laid out flat and 37 million once the beginnings are shared.
 *
 * Nothing ever walks down it, only up, so a node is its stop and the node before it - no children,
 * and no objects. A pattern is the node its last stop sits at, and reading it back is climbing.
 */
export class PatternTree {

  constructor(
    /** the stop at each node */
    public readonly stop: Uint16Array,
    /** the node before it in the pattern, NO_NODE at a first stop */
    public readonly parent: Int32Array,
    /** for each origin, the patterns from it by where they end. A pattern is the node it ends on */
    private readonly from: (Map<StopIdx, number[]> | undefined)[]
  ) {}

  /**
   * The patterns running between two stops, as the stations between them, shortest pattern first.
   *
   * The ends are left out, as they are what was asked for.
   */
  public getPatterns(origin: StopIdx, destination: StopIdx): StopIdx[][] {
    // a pattern is held once for both directions, so it hangs off whichever of its two ends the
    // file wrote first, and a journey the other way round is the same pattern read backwards
    const ends = this.from[origin]?.get(destination) ?? this.from[destination]?.get(origin);

    if (ends === undefined) {
      return [];
    }

    const patterns = ends.map(end => this.stopsOf(end, origin));

    patterns.sort((a, b) => a.length - b.length);

    return patterns;
  }

  /**
   * The stations between the ends of the pattern ending at this node, in the order they are
   * travelled in by someone starting from the given origin.
   */
  private stopsOf(end: number, origin: StopIdx): StopIdx[] {
    const stops: StopIdx[] = [];

    // climbing runs from a pattern's last stop to its first, which is the order it is travelled in
    // when the end it hangs from is the destination rather than the origin
    for (let node = end; node !== NO_NODE; node = this.parent[node]) {
      stops.push(this.stop[node]);
    }

    return (this.stop[end] === origin ? stops : stops.reverse()).slice(1, -1);
  }

}

/**
 * Read a file into the tree it describes.
 *
 * The shared count at the front of a line already names the node the line hangs from, so nothing is
 * rebuilt as the file is read: no path per line, and no string per pattern.
 */
export async function readPatternTree(
  lines: AsyncIterable<string> | Iterable<string>,
  stops: StopTable
): Promise<PatternTree> {
  const nodes = new PatternNodes();
  const from: (Map<StopIdx, number[]> | undefined)[] = [];
  // keyed by the character codes of a station rather than the station, so reading a line does not
  // cut a string out of it for every stop. A national file holds 37 million of them and 2,789 codes
  const ids = new Map<number, StopIdx>();
  /** the node at each depth of the line before, which is what a shared count points into */
  const stack: number[] = [];

  const idOf = (line: string, at: number): StopIdx => {
    let key = 0;

    for (let i = 0; i < CODE_WIDTH; i++) {
      key = (key << 8) | line.charCodeAt(at + i);
    }

    let id = ids.get(key);

    if (id === undefined) {
      id = stops.intern(line.slice(at, at + CODE_WIDTH));
      ids.set(key, id);
    }

    return id;
  };

  for await (const line of lines) {
    // a file ends with a blank line, and a line of nothing but its count names no pattern
    if (line.length <= 1) {
      continue;
    }

    const shared = sharedStops(line);

    let node = shared === 0 ? NO_NODE : stack[shared - 1];
    let depth = shared;

    for (let at = 1; at < line.length; at += CODE_WIDTH) {
      node = nodes.add(idOf(line, at), node);
      stack[depth++] = node;
    }

    const origin = nodes.stopAt(stack[0]);
    const destination = nodes.stopAt(node);

    let patterns = from[origin];

    if (patterns === undefined) {
      patterns = new Map();
      from[origin] = patterns;
    }

    const ending = patterns.get(destination);

    if (ending === undefined) {
      patterns.set(destination, [node]);
    }
    else {
      ending.push(node);
    }
  }

  const { stop, parent } = nodes.build();

  return new PatternTree(stop, parent, from);
}

/**
 * The nodes of a tree as it is being read.
 *
 * A node is a stop and the node before it, so the two are added together and held as a column each.
 * Typed arrays cannot grow, and building this in ordinary arrays first would cost more than the
 * tree is meant to save, so they are doubled as they fill.
 */
class PatternNodes {

  private stop = new Uint16Array(INITIAL_NODES);
  private parent = new Int32Array(INITIAL_NODES);
  private length = 0;

  /** Add a node and return it */
  public add(stop: StopIdx, parent: number): number {
    if (this.length === this.parent.length) {
      this.grow();
    }

    this.stop[this.length] = stop;
    this.parent[this.length] = parent;

    return this.length++;
  }

  public stopAt(node: number): StopIdx {
    return this.stop[node];
  }

  /** The columns cut down to the nodes that were actually added */
  public build(): { stop: Uint16Array, parent: Int32Array } {
    return {
      stop: this.stop.slice(0, this.length),
      parent: this.parent.slice(0, this.length)
    };
  }

  private grow(): void {
    const stop = new Uint16Array(this.length * 2);
    const parent = new Int32Array(this.length * 2);

    stop.set(this.stop);
    parent.set(this.parent);

    this.stop = stop;
    this.parent = parent;
  }

}
