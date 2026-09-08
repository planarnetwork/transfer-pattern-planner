import type { StopIdx, StopTable } from "../../gtfs/StopTable.js";
import { CODE_WIDTH, sharedStops } from "./PatternFormat.js";

/** The parent of a node that starts a pattern, so there is nothing before it */
export const NO_NODE = -1;

/** No origin is open yet, which is only true before the first line is read */
const NO_ORIGIN = -1;

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
    /** for each origin, the patterns from it by where they end */
    private readonly from: (PatternsFromOrigin | undefined)[]
  ) {}

  /**
   * The patterns running between two stops, as the stations between them, shortest pattern first.
   *
   * The ends are left out, as they are what was asked for.
   */
  public getPatterns(origin: StopIdx, destination: StopIdx): StopIdx[][] {
    // a pattern is held once for both directions, so it hangs off whichever of its two ends the
    // file wrote first, and a journey the other way round is the same pattern read backwards
    const ends = this.from[origin]?.endsAt(destination) ?? this.from[destination]?.endsAt(origin);

    if (ends === undefined) {
      return [];
    }

    const patterns: StopIdx[][] = [];

    for (const end of ends) {
      patterns.push(this.stopsOf(end, origin));
    }

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
 * The patterns leaving one station, by where they end.
 *
 * A national feed runs patterns between nearly four million pairs of stations, so a list per pair
 * would be four million objects holding thirty four million numbers between them - more memory in
 * the holding than in the numbers held. Everything one origin knows is packed into a single array
 * instead: how many stations it reaches, which they are, where each one's patterns begin, and then
 * the patterns.
 */
export class PatternsFromOrigin {

  constructor(
    private readonly data: Int32Array
  ) {}

  /**
   * Pack up what one origin reaches. The destinations are put in order so they can be searched.
   */
  public static of(patterns: Map<StopIdx, number[]>): PatternsFromOrigin {
    const destinations = [...patterns.keys()].sort((a, b) => a - b);
    const count = destinations.length;

    let total = 0;

    for (const destination of destinations) {
      total += (patterns.get(destination) as number[]).length;
    }

    const data = new Int32Array(2 + count * 2 + total);
    const ends = 2 + count * 2;

    data[0] = count;

    let at = 0;

    for (let i = 0; i < count; i++) {
      const nodes = patterns.get(destinations[i]) as number[];

      data[1 + i] = destinations[i];
      data[1 + count + i] = at;
      data.set(nodes, ends + at);
      at += nodes.length;
    }

    data[1 + count + count] = at;

    return new PatternsFromOrigin(data);
  }

  /**
   * The node each pattern to this destination ends on, or undefined where none run there.
   *
   * The nodes are a window onto the packed array rather than a copy of it.
   */
  public endsAt(destination: StopIdx): Int32Array | undefined {
    const count = this.data[0];
    const found = this.search(destination, count);

    if (found === NOT_FOUND) {
      return undefined;
    }

    const ends = 2 + count * 2;

    return this.data.subarray(ends + this.data[1 + count + found], ends + this.data[2 + count + found]);
  }

  /**
   * Which of the destinations this is, or NOT_FOUND. They are in order, so this halves the search
   * rather than walking the thousand or so stations a busy origin reaches.
   */
  private search(destination: StopIdx, count: number): number {
    let low = 0;
    let high = count;

    while (low < high) {
      const middle = (low + high) >>> 1;

      if (this.data[1 + middle] < destination) {
        low = middle + 1;
      }
      else {
        high = middle;
      }
    }

    return low < count && this.data[1 + low] === destination ? low : NOT_FOUND;
  }

}

const NOT_FOUND = -1;

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
  const index = new PatternIndex();
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

    index.add(nodes.stopAt(stack[0]), nodes.stopAt(node), node);
  }

  const { stop, parent } = nodes.build();

  return new PatternTree(stop, parent, index.build());
}

/**
 * The patterns of each origin, as the file is read.
 *
 * A sorted file finishes with one origin before it starts the next, so only the origin being read
 * is held as a map: it is packed down as soon as the file leaves it, and what is kept from then on
 * is one array rather than a list per destination. Holding all of them and packing at the end would
 * cost more at once than the packing saves.
 */
class PatternIndex {

  private readonly from: (PatternsFromOrigin | undefined)[] = [];
  private origin = NO_ORIGIN;
  private open = new Map<StopIdx, number[]>();

  public add(origin: StopIdx, destination: StopIdx, node: number): void {
    if (origin !== this.origin) {
      this.close();
      this.origin = origin;
    }

    const ending = this.open.get(destination);

    if (ending === undefined) {
      this.open.set(destination, [node]);
    }
    else {
      ending.push(node);
    }
  }

  public build(): (PatternsFromOrigin | undefined)[] {
    this.close();

    return this.from;
  }

  private close(): void {
    if (this.origin === NO_ORIGIN) {
      return;
    }

    if (this.from[this.origin] !== undefined) {
      throw new Error(
        "Transfer patterns are written in order, so every pattern from a station is together in the " +
        "file. This one returns to a station it had already left, which would lose the patterns read " +
        "the first time."
      );
    }

    this.from[this.origin] = PatternsFromOrigin.of(this.open);
    this.open = new Map();
  }

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
