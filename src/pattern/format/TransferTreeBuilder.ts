import type { StopIdx, StopTable } from "../../gtfs/StopTable.js";
import { CODE_WIDTH, sharedStops } from "./PatternFormat.js";
import { NO_NODE, TransferTreeNodes } from "../repository/TransferTreeNodes.js";
import { StationTransferTree } from "../repository/StationTransferTree.js";
import { TransferTreeRepository } from "../repository/TransferTreeRepository.js";

/** No origin is open, which is only true before the first line and after the last */
const NO_ORIGIN = -1;

/**
 * Reads a file into the tree it describes. One of these reads one file.
 *
 * The shared count at the front of a line already names the node it hangs from, so nothing is
 * rebuilt on the way in: no path per line, and no string per pattern.
 */
export class TransferTreeBuilder {

  private readonly nodes = new TransferTreeNodes();
  private readonly from: (StationTransferTree | undefined)[] = [];
  /** station codes by their characters, so a line is not cut up for a station already seen */
  private readonly ids = new Map<number, StopIdx>();
  /** the node at each depth of the line before, which is what a shared count points into */
  private readonly stack: number[] = [];

  private origin = NO_ORIGIN;
  private open = new Map<StopIdx, number[]>();

  constructor(
    private readonly stops: StopTable
  ) {}

  public async read(lines: AsyncIterable<string> | Iterable<string>): Promise<TransferTreeRepository> {
    for await (const line of lines) {
      // a file ends with a blank line, and a line of nothing but its count names no pattern
      if (line.length > 1) {
        this.addLine(line);
      }
    }

    this.closeOrigin();

    return new TransferTreeRepository(this.nodes.stopColumn(), this.nodes.parentColumn(), this.from);
  }

  private addLine(line: string): void {
    const shared = sharedStops(line);

    let node = shared === 0 ? NO_NODE : this.stack[shared - 1];
    let depth = shared;

    for (let at = 1; at < line.length; at += CODE_WIDTH) {
      node = this.nodes.add(this.idOf(line, at), node);
      this.stack[depth++] = node;
    }

    this.addPattern(this.nodes.stopAt(this.stack[0]), this.nodes.stopAt(node), node);
  }

  /**
   * A sorted file finishes with one origin before starting the next, so only the origin being read
   * is held as a map and it is packed down as soon as the file leaves it. Holding every origin and
   * packing at the end would cost more at its peak than the packing saves.
   */
  private addPattern(origin: StopIdx, destination: StopIdx, node: number): void {
    if (origin !== this.origin) {
      this.closeOrigin();
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

  private closeOrigin(): void {
    if (this.origin === NO_ORIGIN) {
      return;
    }

    if (this.from[this.origin] !== undefined) {
      throw new Error(
        "Transfer patterns are written in order, so every pattern from a station is together in the " +
        "file. This one returns to a station it had already left, which would lose the patterns " +
        "read the first time."
      );
    }

    this.from[this.origin] = new StationTransferTree(this.open);
    this.open = new Map();
  }

  /** Keyed by characters rather than string, so a national file cuts out 2,789 codes not 37 million */
  private idOf(line: string, at: number): StopIdx {
    let key = 0;

    for (let i = 0; i < CODE_WIDTH; i++) {
      key = (key << 8) | line.charCodeAt(at + i);
    }

    let id = this.ids.get(key);

    if (id === undefined) {
      id = this.stops.intern(line.slice(at, at + CODE_WIDTH));
      this.ids.set(key, id);
    }

    return id;
  }

}
