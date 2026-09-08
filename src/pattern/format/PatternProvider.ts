import type { StopID } from "@gb-transit/gtfs-loader";

/**
 * Where one station's patterns come from.
 *
 * The station names the thing to fetch, so nothing has to hold an index of where each one is: on a
 * disk it is a file per station, and over a network it is a URL per station, which a browser and a
 * cache can both reason about on their own.
 */
export interface PatternProvider {
  /**
   * The compressed patterns of a station, or undefined where the feed has none for it.
   */
  get(station: StopID): Promise<Uint8Array | undefined>;
}
