import type { StopIdx, StopTable } from "../../gtfs/StopTable.js";
import { PatternLoader } from "../format/PatternLoader.js";
import type { PatternProvider } from "../format/PatternProvider.js";
import type { TransferPatternRepository } from "./TransferPatternRepository.js";
import type { TransferTreeRepository } from "./TransferTreeRepository.js";

/** Stations to keep once they have been read, before the least recently asked for is dropped */
const DEFAULT_LIMIT = 100;

/**
 * The patterns of a station, read when a query asks for them and not before.
 *
 * A file written per station holds every pattern that touches it, in both directions, so a query
 * only ever needs the stations it departs from. The whole feed is 34 million patterns and half a
 * gigabyte held; one station is a few thousand and a few tens of kilobytes.
 *
 * `prepare` has to be called first, which `DepartAfterQuery` does. A station is read once and kept
 * until the room runs out.
 */
export class LazyTransferTreeRepository implements TransferPatternRepository {

  private readonly stations = new Map<StopIdx, TransferTreeRepository | undefined>();
  private readonly loader: PatternLoader;

  constructor(
    private readonly provider: PatternProvider,
    private readonly stops: StopTable,
    private readonly limit: number = DEFAULT_LIMIT
  ) {
    this.loader = new PatternLoader(stops);
  }

  /**
   * Read the stations a query is about to ask about, the ones it does not already hold.
   */
  public async prepare(origins: StopIdx[]): Promise<void> {
    const wanted = [...new Set(origins)].filter(origin => !this.stations.has(origin));

    await Promise.all(wanted.map(async origin => {
      const patterns = await this.provider.get(this.stops.nameOf(origin));

      // a station the feed runs nothing from has no file, and no patterns either
      this.stations.set(origin, patterns && await this.loader.load(patterns));
    }));

    this.forget();
  }

  public getPatterns(origin: StopIdx, destination: StopIdx): StopIdx[][] {
    if (!this.stations.has(origin)) {
      throw new Error(
        `The patterns for ${this.stops.nameOf(origin)} have not been read. This repository reads a ` +
        "station when it is asked to, so prepare must be given every origin before a query runs."
      );
    }

    return this.stations.get(origin)?.getPatterns(origin, destination) ?? [];
  }

  /** The first key of a Map is the one added longest ago, which is the one to lose */
  private forget(): void {
    while (this.stations.size > this.limit) {
      this.stations.delete(this.stations.keys().next().value as StopIdx);
    }
  }

}
