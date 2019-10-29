import { DateNumber, DayOfWeek, StopID } from "../gtfs/Gtfs";
import { TransferPattern } from "./TransferPattern";
import { TimetableLegRepository } from "./repository/TimetableLegRepository";
import { TransferRepository } from "./repository/TransferRepository";
import { Interchange } from "../gtfs/GtfsLoader";
import { TransferPatternNode } from "./TransferPatternNode";
import { TransferPatternRepository } from "./repository/TransferPatternRepository";

/**
 * Creates transfer patterns
 */
export class TransferPatternFactory {

  constructor(
    private readonly patternRepository: TransferPatternRepository,
    private readonly timetableLegRepository: TimetableLegRepository,
    private readonly transferRepository: TransferRepository,
    private readonly interchange: Interchange
  ) {}

  /**
   * Create a transfer pattern for every origin. Each transfer pattern may arrive at a different destination.
   */
  public async getTransferPatterns(
    origins: StopID[],
    destinations: StopID[],
    date: DateNumber,
    dow: DayOfWeek
  ): Promise<TransferPattern[]> {
    const patterns = await this.patternRepository.getPatterns(origins, destinations);

    return origins.map(o => this.getTransferPatternForOrigin(patterns, o, origins, destinations, date, dow));
  }

  private getTransferPatternForOrigin(
    patterns: Record<string, string[][]>,
    origin: StopID,
    origins: StopID[],
    destinations: StopID[],
    date: DateNumber,
    dow: DayOfWeek
  ): TransferPattern {
    const tree = { stop: origin, children: {} } as TransferPatternTreeNode;

    for (const destination of destinations) {
      for (const patternStops of patterns[origin + destination]) {
        if (this.doesNotContainGroupStops(patternStops, origins, destinations)) {
          patternStops.push(destination);

          patternStops.reduce((treeNode: TransferPatternTreeNode, stop: StopID) => {
            return treeNode.children[stop] = treeNode.children[stop] || { stop, parent: treeNode, children: {} };
          }, tree);
        }
      }
    }

    return new TransferPattern(
      origin,
      Object.values(tree.children).map(n => this.getPatternNode(n, date, dow)),
      this.interchange
    );
  }

  private doesNotContainGroupStops(pattern: StopID[], origins: StopID[], destinations: StopID[]): boolean {
    return origins.every(s => !pattern.includes(s)) && destinations.every(s => !pattern.includes(s));
  }

  private getPatternNode(
    node: TransferPatternTreeNode,
    date: DateNumber,
    dow: DayOfWeek
  ): TransferPatternNode {
    const timetableLegs = this.timetableLegRepository.getLegs(node.parent.stop, node.stop, date, dow);
    const transfers = this.transferRepository.getTransfers(node.parent.stop, node.stop);

    return new TransferPatternNode(
      timetableLegs,
      transfers,
      Object.values(node.children).map(n => this.getPatternNode(n, date, dow)),
      this.interchange[node.stop]
    );
  }

}

interface TransferPatternTreeNode {
  stop: StopID,
  parent: TransferPatternTreeNode,
  children: Record<StopID, TransferPatternTreeNode>
}
