import type { StopID } from "@gb-transit/gtfs-loader";

/**
 * The patterns found from one station, keyed by the pair of stations they run between, with the
 * change points of each held as a tree.
 *
 * A day of scans from one station finds the same patterns over and over: on a national feed some
 * two million paths turn into a few thousand of them. Naming a path costs more than discovering it
 * has been seen before, so the change points are collected into a tree and only turned into
 * strings by lines, once each.
 */
export class PatternIndex {
  /** Origin stop, then destination stop, then the change points between them */
  private readonly journeys = new Map<StopID, Map<StopID, PatternNode>>();

  /**
   * File a path under the pair of stops it runs between.
   *
   * changePoints holds the stops it was boarded at, last first, so the stop it departed from is at
   * `length - 1`. The pair is ordered by stop id, as the key is, and the tree is descended in the
   * order that key will name the change points in, so nothing has to be reversed later.
   */
  public add(changePoints: StopID[], length: number, arrival: StopID): void {
    const departure = changePoints[length - 1];
    const forwards = departure <= arrival;

    let node = this.patternsBetween(forwards ? departure : arrival, forwards ? arrival : departure);

    if (forwards) {
      for (let i = length - 2; i >= 0; i--) {
        node = descend(node, changePoints[i]);
      }
    }
    else {
      for (let i = 0; i <= length - 2; i++) {
        node = descend(node, changePoints[i]);
      }
    }

    node.end = true;
  }

  /**
   * The lines these patterns are written as, one per pattern: the stations it calls at, three
   * characters each, with nothing between them.
   *
   * The two ends are written in the order they are keyed in, which is alphabetical rather than the
   * order anyone travelled: a pattern covers both directions, so it is one line either way.
   */
  public lines(): string[] {
    const lines: string[] = [];

    for (const [origin, destinations] of this.journeys) {
      for (const [destination, pattern] of destinations) {
        this.write(pattern, origin, destination, [], lines);
      }
    }

    return lines;
  }

  /**
   * Write every pattern at or below this node
   */
  private write(
    node: PatternNode,
    origin: StopID,
    destination: StopID,
    changePoints: StopID[],
    into: string[]
  ): void {
    if (node.end) {
      into.push(origin + changePoints.join("") + destination);
    }

    for (const [stop, child] of node.children) {
      changePoints.push(stop);
      this.write(child, origin, destination, changePoints, into);
      changePoints.pop();
    }
  }

  private patternsBetween(from: StopID, to: StopID): PatternNode {
    let destinations = this.journeys.get(from);

    if (destinations === undefined) {
      destinations = new Map();
      this.journeys.set(from, destinations);
    }

    let pattern = destinations.get(to);

    if (pattern === undefined) {
      pattern = newNode();
      destinations.set(to, pattern);
    }

    return pattern;
  }

}

function descend(node: PatternNode, stop: StopID): PatternNode {
  let child = node.children.get(stop);

  if (child === undefined) {
    child = newNode();
    node.children.set(stop, child);
  }

  return child;
}

function newNode(): PatternNode {
  return { children: new Map(), end: false };
}

/**
 * A change point of a pattern and the change points that may follow it. `end` marks a pattern that
 * stops here, which a longer one may also run through.
 */
interface PatternNode {
  children: Map<StopID, PatternNode>;
  end: boolean;
}
