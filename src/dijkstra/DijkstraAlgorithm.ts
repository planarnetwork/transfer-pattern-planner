import { AnyLeg, Interchange, isTransfer, OriginDepartureTimes, StopID } from "..";
import { TransferPatternEdge } from "./GraphFactory";

/**
 * Implementation of dijkstra's shortest path algorithm that returns a tree instead of a path.
 */
export class DijkstraAlgorithm {

  constructor(
    private readonly interchange: Interchange
  ) { }

  /**
   * Return a shortest path tree from the given node to every other node the graph. Nodes not connected by an edge will
   * have a distance of Number.MAX_SAFE_INTEGER
   */
  public getTree(nodeEdges: NodeEdges, originTimes: OriginDepartureTimes): ShortestPathTree {
    const earliestArrivals = {};
    const queue: Queue = [];

    // set the initial distance to each node to max and add each node to the queue
    for (const node of Object.keys(nodeEdges)) {
      const earliestArrival = originTimes[node] || Number.MAX_SAFE_INTEGER;

      queue.push([node, earliestArrival]);
      earliestArrivals[node] = earliestArrival;
    }

    const connections = {};

    // while we have edges left to check
    while (queue.length > 0) {
      // note that the sort is descending (longest first) as pop() is faster than shift()
      queue.sort((a, b) => b[1] - a[1]);

      // take closest node off the queue
      const [current, nextDepartureTime] = queue.pop() as [Node, number];

      // iterate the nodes edges
      for (const edge of nodeEdges[current]) {
        // see if the new distance is shorter than the one we have
        const firstAvailableLeg = edge.getLeg(nextDepartureTime);

        if (firstAvailableLeg) {
          const interchange = this.interchange[firstAvailableLeg.destination];
          const newEarliestArrival = isTransfer(firstAvailableLeg)
            ? nextDepartureTime + firstAvailableLeg.duration + interchange
            : firstAvailableLeg.stopTimes[firstAvailableLeg.stopTimes.length - 1].arrivalTime + interchange;

          if (newEarliestArrival < earliestArrivals[firstAvailableLeg.destination]) {
            const indexInQueue = queue.findIndex(queueItem => queueItem[0] === firstAvailableLeg.destination);

            // update the tree and the queue
            earliestArrivals[firstAvailableLeg.destination] = newEarliestArrival;
            connections[firstAvailableLeg.destination] = firstAvailableLeg;
            queue[indexInQueue] = [firstAvailableLeg.destination, newEarliestArrival];
          }
        }
      }
    }

    return connections;
  }

}

/**
 * A node is just represented by it's label
 */
export type Node = string;

/**
 * A graph is represented by a list of edges
 */
export type Graph = TransferPatternEdge[];

/**
 * Leg with the earliest arrival at each node
 */
export type ShortestPathTree = Record<StopID, AnyLeg>;

/**
 * Index of origin nodes and all their edges
 */
export type NodeEdges = Record<StopID, TransferPatternEdge[]>;

/**
 * Sortable queue of Node and shortest distance to Node
 */
type Queue = [Node, number][];
