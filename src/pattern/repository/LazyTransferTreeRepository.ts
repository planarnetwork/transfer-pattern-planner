import type { StopIdx, StopTable } from "../../gtfs/StopTable.js";
import { PatternLoader } from "../format/PatternLoader.js";
import type { PatternProvider } from "../format/PatternProvider.js";
import type { TransferPatternRepository } from "./TransferPatternRepository.js";
import type { TransferTreeRepository } from "./TransferTreeRepository.js";

/** Stations to keep before the one asked for longest ago is dropped */
const DEFAULT_LIMIT = 100;

/**
 * The patterns of a station, read when a query asks for them and not before.
 *
 * A file written per station holds every pattern that touches it, in both directions, so a query
 * only ever needs the stations it departs from. The whole feed is 34 million patterns and half a
 * gigabyte held; one station is a few thousand and a few tens of kilobytes.
 *
 * `prepare` has to be called first, which `DepartAfterQuery` does. Nothing is read twice: a station
 * being read when it is asked for again is waited on rather than fetched a second time.
 *
 * One of these serves one query at a time. Two queries running at once share what it holds, which
 * is what makes it worth having, but a limit smaller than the stations they need between them will
 * have one drop what the other is about to ask for. The default holds a hundred, and a query of its
 * own origins is never dropped whatever the limit says.
 */
export class LazyTransferTreeRepository implements TransferPatternRepository {

  private readonly stations = new Map<StopIdx, TransferTreeRepository | undefined>();
  private readonly reading = new Map<StopIdx, Promise<TransferTreeRepository | undefined>>();
  private readonly loader: PatternLoader;

  constructor(
    private readonly provider: PatternProvider,
    private readonly stops: StopTable,
    private readonly limit: number = DEFAULT_LIMIT
  ) {
    this.loader = new PatternLoader(stops);
  }

  /**
   * Read the stations a query is about to ask about, and keep the ones already held.
   */
  public async prepare(origins: StopIdx[]): Promise<void> {
    const wanted = [...new Set(origins)];

    await Promise.all(wanted.map(origin => this.hold(origin)));

    this.forget(wanted.length);
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

  /**
   * Put a station at the back of the queue to be dropped, reading it first if it is not held.
   *
   * A station asked for again is moved rather than left where it was, or the stations a query is
   * preparing would be the first ones it dropped.
   */
  private async hold(origin: StopIdx): Promise<void> {
    if (this.stations.has(origin)) {
      const held = this.stations.get(origin);

      this.stations.delete(origin);
      this.stations.set(origin, held);

      return;
    }

    let reading = this.reading.get(origin);

    if (reading === undefined) {
      reading = this.read(origin);
      this.reading.set(origin, reading);
    }

    const patterns = await reading;

    this.reading.delete(origin);
    this.stations.delete(origin);
    this.stations.set(origin, patterns);
  }

  private async read(origin: StopIdx): Promise<TransferTreeRepository | undefined> {
    // a station the feed runs nothing from has no file, and no patterns either
    const patterns = await this.provider.get(this.stops.nameOf(origin));

    return patterns && this.loader.load(patterns);
  }

  /**
   * Drop the stations asked for longest ago, keeping at least what the query being prepared needs:
   * a group larger than the limit is worth holding for the length of a query rather than failing.
   */
  private forget(keep: number): void {
    const limit = Math.max(this.limit, keep);

    while (this.stations.size > limit) {
      this.stations.delete(this.stations.keys().next().value as StopIdx);
    }
  }

}
