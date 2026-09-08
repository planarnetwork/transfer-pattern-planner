import type { StopIdx } from "../../gtfs/StopTable.js";

/**
 * The transfer patterns between two stations.
 */
export interface TransferPatternRepository {
  /**
   * The stations between the two ends of each pattern, shortest pattern first. The ends are left
   * out, as they are what was asked for.
   */
  getPatterns(origin: StopIdx, destination: StopIdx): StopIdx[][];

  /**
   * Fetch what a query is about to ask for.
   *
   * A repository that holds everything has nothing to do here. One that does not - reading a file
   * per station, or fetching it - cannot go and get a station while `getPatterns` is answering,
   * because that answer is not awaited. Without this it would return no patterns for a station it
   * has not seen, and the query would come back short rather than fail.
   */
  prepare?(origins: StopIdx[]): Promise<void>;
}
