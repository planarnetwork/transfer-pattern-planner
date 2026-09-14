import type { StopID } from "@gb-transit/gtfs-loader";

/**
 * Finds the patterns of a whole day from one station, whichever algorithm scans for them.
 */
export interface PatternQuery {
  plan(origin: StopID, date: Date): string[];
}
