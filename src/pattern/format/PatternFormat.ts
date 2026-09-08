import type { StopID } from "@gb-transit/gtfs-loader";

/** A transfer pattern as the stations it calls at, first to last */
export type PatternPath = StopID[];

/** Characters in a station code. Every code is this wide, so a line is cut up rather than split */
export const CODE_WIDTH = 3;

/**
 * The character a shared count of nothing is written as. Counting up from it rather than writing a
 * digit means a count above nine carries on past `9` instead of overflowing, and a national feed
 * holds patterns of fourteen stations.
 */
export const NONE_SHARED = "0".charCodeAt(0);

/** How many leading stations a line takes from the line before it */
export function sharedStops(line: string): number {
  return line.charCodeAt(0) - NONE_SHARED;
}

/** A code of another width would run into the one after it, and the whole line would come back wrong */
export function checkCodeWidths(stopIds: StopID[]): void {
  const wrong = stopIds.filter(stop => stop.length !== CODE_WIDTH);

  if (wrong.length > 0) {
    throw new Error(
      `Transfer patterns are written with ${CODE_WIDTH} character station codes, but ` +
      `${wrong.length} of ${stopIds.length} are a different length, starting with ` +
      `${wrong.slice(0, 5).map(stop => `"${stop}"`).join(", ")}`
    );
  }
}
