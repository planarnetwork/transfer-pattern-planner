import type { StopID } from "@gb-transit/gtfs-loader";

/**
 * A station as everything below the query works in it.
 *
 * The feed and the patterns both name a station by its code, and everything between a query and its
 * results asks about stations often enough that comparing and keying on those strings shows up. A
 * query exchanges the codes it was asked in for one of these on the way in, and the results name
 * them again on the way out, which is the only place a code is needed.
 */
export type StopIdx = number;

/** A station neither the feed nor the patterns has heard of, so nothing runs to or from it */
export const UNKNOWN_STOP = -1;

/**
 * Stops are held in a Uint16Array, so this is one more than the highest index one can name. Three
 * character codes from an alphabet of 36 cannot reach it, and the GB feed uses 2,789 of them.
 */
const STOP_LIMIT = 65536;

/**
 * The stations a feed and its patterns name, numbered.
 *
 * One of these is shared by the two of them so that they speak of a station the same way. They are
 * read from separate files, which are loaded at the same time and add to this as they go: whichever
 * reaches a station first numbers it, and the other finds it already numbered.
 */
export class StopTable {

  private readonly codes: StopID[] = [];
  private readonly indexes = new Map<StopID, StopIdx>();

  /**
   * The index of a station, numbering it if it has not been seen before
   */
  public intern(code: StopID): StopIdx {
    const index = this.indexes.get(code);

    if (index !== undefined) {
      return index;
    }

    if (this.codes.length === STOP_LIMIT) {
      throw new Error(`A feed and its patterns may name up to ${STOP_LIMIT} stations, and these name more`);
    }

    this.indexes.set(code, this.codes.length);
    this.codes.push(code);

    return this.codes.length - 1;
  }

  /**
   * The index of a station, or UNKNOWN_STOP where neither the feed nor the patterns names it
   */
  public indexOf(code: StopID): StopIdx {
    return this.indexes.get(code) ?? UNKNOWN_STOP;
  }

  /**
   * The code of a station, for naming it in a result
   */
  public nameOf(index: StopIdx): StopID {
    return this.codes[index];
  }

  /**
   * Every station numbered so far, in the order they were met
   */
  public get names(): readonly StopID[] {
    return this.codes;
  }

}
