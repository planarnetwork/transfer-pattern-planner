import { DijkstraAlgorithm, NodeEdges, ShortestPathTree } from "./DijkstraAlgorithm";
import { AnyLeg, DayOfWeek, Journey, JourneyFactory, JourneyFilter, OriginDepartureTimes, StopID, Time } from "..";
import { keyValue } from "ts-array-utils";
import { GraphFactory, TransferPatternEdge } from "./GraphFactory";

/**
 * Search for journeys between a set of origin and destinations departing after a given time.
 */
export class DijkstraQuery {

  constructor(
    private readonly graphFactory: GraphFactory,
    private readonly dijkstra: DijkstraAlgorithm,
    private readonly resultsFactory: JourneyFactory,
    private readonly filters: JourneyFilter[] = []
  ) { }

  /**
   * Plan a journey between the origin and destination set of stops on the given date and time
   */
  public async plan(origins: StopID[], destinations: StopID[], date: Date, time: Time): Promise<Journey[]> {
    const dateNumber = this.getDateNumber(date);
    const dayOfWeek = date.getDay() as DayOfWeek;
    const graph = await this.graphFactory.getGraph(origins, destinations, dateNumber, dayOfWeek);
    const edges = graph.reduce(this.getNodeEdges, {});
    const departureTimes = this.getDepartureTimes(edges, origins);
    const journeys = [] as Journey[];

    for (const originTimes of departureTimes) {
      const tree = this.dijkstra.getTree(edges, originTimes);
      journeys.push(...this.getJourneys(tree, destinations));
    }

    // apply each filter to the results
    return this.filters.reduce((rs, filter) => filter.apply(rs), journeys);
  }

  private getDateNumber(date: Date): number {
    const str = date.toISOString();

    return parseInt(str.slice(0, 4) + str.slice(5, 7) + str.slice(8, 10), 10);
  }

  /**
   * Index the edges by origin
   */
  private getNodeEdges(nodes: NodeEdges, edge: TransferPatternEdge): NodeEdges {
    nodes[edge.origin] = nodes[edge.origin] || [];
    nodes[edge.origin].push(edge);
    nodes[edge.destination] = nodes[edge.destination] || [];

    return nodes;
  }

  private getJourneys(tree: ShortestPathTree, destinations: StopID[]): Journey[] {
    return destinations
      .map(d => this.getJourney(tree, d, []))
      .filter(legs => legs.length > 0)
      .map(legs => this.resultsFactory.getJourney(legs.reverse()));
  }

  private getJourney(tree: ShortestPathTree, destination: StopID, legs: AnyLeg[]): AnyLeg[] {
    if (!tree[destination]) {
      return legs;
    }

    legs.push(tree[destination]);

    return this.getJourney(tree, tree[destination].origin, legs);
  }

  private getDepartureTimes(edges: NodeEdges, origins: StopID[]): OriginDepartureTimes[] {
    const times = [] as Time[];

    for (const origin of origins) {
      for (const edge of edges[origin]) {
        times.push(...edge.timetableLegs.map(l => l.stopTimes[0].departureTime));
      }
    }

    return times.map(t => origins.reduce(keyValue(origin => [origin, t]), {}));

  }
}
