import { DayOfWeek, StopID } from "../gtfs/Gtfs";
import { TransferPattern } from "./TransferPattern";
import { TimetableLegRepository } from "./repository/TimetableLegRepository";
import { TransferRepository } from "./repository/TransferRepository";

export class TransferPatternFactory {

  constructor(
    private readonly patternRepository: any,
    private readonly timetableLegRepository: TimetableLegRepository,
    private readonly transferRepository: TransferRepository,
  ) {}

  public getTransferPatterns(origins: StopID[], destinations: StopID[], date: number, dow: DayOfWeek): TransferPattern[] {
    const patterns: TransferPattern[] = [];

    for (const origin of origins) {
      const tree = { stop: origin, children: {} };

      for (const destination of destinations) {
        for (const patternString of this.patternRepository.getPatterns(origin, destination)) {
          if (this.doesNotContainGroupStops(patternString, origins, origin, destinations, destination)) {
            const stops = [...patternString.split(","), destination];

            stops.reduce((treeNode: TransferPatternTreeNode, stop: StopID) => {
              return treeNode.children[stop] = treeNode.children[stop] || { stop, parent: treeNode, children: {} };
            }, tree);
          }
        }
      }

      patterns.push(tree);
    }

    return patterns;
  }

  private doesNotContainGroupStops(
    pattern: string,
    origins: StopID[],
    origin: StopID,
    destinations: StopID[],
    destination: StopID
  ): boolean {
    return this.doesNotContainStops(pattern, origins, origin)
        && this.doesNotContainStops(pattern, destinations, destination);
  }

  private doesNotContainStops(pattern: string, stops: StopID[], allowedStop: StopID): boolean {
    return stops.every(s => s === allowedStop || !pattern.includes(s));
  }
}


export interface TransferPatternTreeNode {
  stop: StopID,
  parent: TransferPatternTreeNode,
  children: Record<StopID, TransferPatternTreeNode>
}
