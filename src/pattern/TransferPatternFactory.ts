import type { DateNumber, DayOfWeek } from "@gb-transit/gtfs-loader";
import type { InterchangeTimes } from "../gtfs/GtfsLoader.js";
import type { StopIdx } from "../gtfs/StopTable.js";
import type { TimetableLegRepository } from "./repository/TimetableLegRepository.js";
import type { TransferPatternRepository } from "./repository/TransferPatternRepository.js";
import type { TransferRepository } from "./repository/TransferRepository.js";
import { TransferPattern } from "./TransferPattern.js";
import { TransferPatternNode } from "./TransferPatternNode.js";

/**
 * Creates transfer patterns
 */
export class TransferPatternFactory {

  constructor(
    private readonly patternRepository: TransferPatternRepository,
    private readonly timetableLegRepository: TimetableLegRepository,
    private readonly transferRepository: TransferRepository,
    private readonly interchange: InterchangeTimes
  ) {}

  /**
   * Create a transfer pattern for every origin. Each transfer pattern may arrive at a different destination.
   */
  public getTransferPatterns(
    origins: StopIdx[],
    destinations: StopIdx[],
    date: DateNumber,
    dow: DayOfWeek
  ): TransferPattern[] {
    return origins.map(origin => this.getTransferPatternForOrigin(origin, destinations, date, dow));
  }

  private getTransferPatternForOrigin(
    origin: StopIdx,
    destinations: StopIdx[],
    date: DateNumber,
    dow: DayOfWeek
  ): TransferPattern {
    const tree = { stop: origin, children: new Map() } as PatternTreeNode;

    for (const destination of destinations) {
      // a pair with no pattern between them is not an error, there is just no journey to plan
      for (const patternStops of this.patternRepository.getPatterns(origin, destination)) {
        if (this.doesNotContainAnotherDestination(patternStops, destinations)) {
          let treeNode = tree;

          for (const stop of [...patternStops, destination]) {
            let child = treeNode.children.get(stop);

            if (child === undefined) {
              child = { stop, parent: treeNode, children: new Map() };
              treeNode.children.set(stop, child);
            }

            treeNode = child;
          }
        }
      }
    }

    return new TransferPattern(
      origin,
      [...tree.children.values()].map(n => this.getPatternNode(n, date, dow))
    );
  }

  /**
   * A pattern changing at another destination is dropped because the pattern ending there is in the
   * same tree, so the journey is offered once rather than twice. Origins are not filtered this way:
   * each has its own tree and nothing joins them, so such a pattern would have no substitute.
   */
  private doesNotContainAnotherDestination(pattern: StopIdx[], destinations: StopIdx[]): boolean {
    return destinations.every(s => !pattern.includes(s));
  }

  private getPatternNode(
    node: PatternTreeNode,
    date: DateNumber,
    dow: DayOfWeek
  ): TransferPatternNode {
    const timetableLegs = this.timetableLegRepository.getLegs(node.parent.stop, node.stop, date, dow);
    const transfers = this.transferRepository.getTransfers(node.parent.stop, node.stop);

    return new TransferPatternNode(
      timetableLegs,
      transfers,
      [...node.children.values()].map(n => this.getPatternNode(n, date, dow)),
      this.interchange[node.stop] ?? 0
    );
  }

}

interface PatternTreeNode {
  stop: StopIdx,
  parent: PatternTreeNode,
  children: Map<StopIdx, PatternTreeNode>
}
