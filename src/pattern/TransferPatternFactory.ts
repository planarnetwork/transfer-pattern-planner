import { DateNumber, DayOfWeek, StopID } from "../gtfs/Gtfs";
import { TransferPattern } from "./TransferPattern";
import { TimetableLegRepository } from "./repository/TimetableLegRepository";
import { TransferRepository } from "./repository/TransferRepository";
import { Interchange } from "../gtfs/GtfsLoader";
import { TransferPatternNode } from "./TransferPatternNode";
import { TransferPatternRepository } from "./repository/TransferPatternRepository";

export class TransferPatternFactory {

  constructor(
    private readonly patternRepository: TransferPatternRepository,
    private readonly timetableLegRepository: TimetableLegRepository,
    private readonly transferRepository: TransferRepository,
    private readonly interchange: Interchange
  ) {}

  public getTransferPatterns(
    origins: StopID[],
    destinations: StopID[],
    date: DateNumber,
    dow: DayOfWeek
  ): Promise<TransferPattern[]> {
    return Promise.all(
      origins.map(o => this.getTransferPatternForOrigin(o, origins, destinations, date, dow))
    );
  }

  private async getTransferPatternForOrigin(
    origin: StopID,
    origins: StopID[],
    destinations: StopID[],
    date: DateNumber,
    dow: DayOfWeek
  ): Promise<TransferPattern> {
    const tree = { stop: origin, children: {} } as TransferPatternTreeNode;

    for (const destination of destinations) {
      for (const patternStops of await this.patternRepository.getPatterns(origin, destination)) {
        if (this.doesNotContainGroupStops(patternStops, origins, destinations)) {
          patternStops.push(destination);

          patternStops.reduce((treeNode: TransferPatternTreeNode, stop: StopID) => {
            return treeNode.children[stop] = treeNode.children[stop] || { stop, parent: treeNode, children: {} };
          }, tree);
        }
      }
    }

    return new TransferPattern(origin, this.getPatternNodes(tree.children, date, dow), this.interchange);
  }

  private doesNotContainGroupStops(pattern: StopID[], origins: StopID[], destinations: StopID[]): boolean {
    return origins.every(s => !pattern.includes(s)) && destinations.every(s => !pattern.includes(s));
  }

  private getPatternNodes(
    children: Record<StopID, TransferPatternTreeNode>,
    date: DateNumber,
    dow: DayOfWeek
  ): TransferPatternNode[] {
    return Object.values(children).map(node => new TransferPatternNode(
      this.timetableLegRepository.getLegs(node.parent.stop, node.stop, date, dow),
      this.transferRepository.getTransfers(node.parent.stop, node.stop),
      Object.values(node.children).length > 0 ? this.getPatternNodes(node.children, date, dow) : [],
      this.interchange[node.stop]
    ));
  }

}

interface TransferPatternTreeNode {
  stop: StopID,
  parent: TransferPatternTreeNode,
  children: Record<StopID, TransferPatternTreeNode>
}
