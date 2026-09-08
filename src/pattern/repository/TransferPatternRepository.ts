import type { StopIdx } from "../../gtfs/StopTable.js";

/**
 * The transfer patterns between two stations.
 *
 * Asked a pair at a time, and answered from memory: this used to be a database table, which is why
 * it took every origin and destination of a query at once and answered with a promise.
 */
export interface TransferPatternRepository {
  /**
   * The stations between the two ends of each pattern, shortest pattern first. The ends are left
   * out, as they are what was asked for.
   */
  getPatterns(origin: StopIdx, destination: StopIdx): StopIdx[][];
}
