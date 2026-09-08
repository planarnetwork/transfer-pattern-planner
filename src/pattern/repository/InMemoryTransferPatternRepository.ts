import type { StopIdx } from "../../StopTable.js";
import { type PatternTree, patternsBetween } from "./PatternTree.js";
import type { TransferPatternRepository } from "./TransferPatternRepository.js";

/**
 * Loads transfer patterns from a tree held in memory
 */
export class InMemoryTransferPatternRepository implements TransferPatternRepository {

  constructor(
    private readonly patterns: PatternTree
  ) { }

  public getPatterns(origin: StopIdx, destination: StopIdx): StopIdx[][] {
    return patternsBetween(this.patterns, origin, destination);
  }

}
