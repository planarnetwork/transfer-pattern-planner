import type { GtfsData } from "./gtfs/GtfsLoader.js";
import { JourneyFactory } from "./journey/JourneyFactory.js";
import { TimetableLegRepository } from "./pattern/repository/TimetableLegRepository.js";
import type { TransferPatternRepository } from "./pattern/repository/TransferPatternRepository.js";
import { TransferRepository } from "./pattern/repository/TransferRepository.js";
import { TransferPatternFactory } from "./pattern/TransferPatternFactory.js";
import { TransferPatternPlanner } from "./pattern/TransferPatternPlanner.js";
import { DepartAfterQuery } from "./query/DepartAfterQuery.js";
import type { JourneyFilter } from "./query/JourneyFilter.js";
import { MultipleCriteriaFilter } from "./query/MultipleCriteriaFilter.js";
import type { StopTable } from "./StopTable.js";

/**
 * A query over a feed and the transfer patterns for it.
 *
 * Both are loaded the same way wherever this runs, so this is all the wiring there is between
 * having them and being able to plan. The stop table is the one they were both read against, which
 * is what lets them speak of a station the same way:
 *
 * ```
 * const stops = stopTable();
 * const [gtfs, patterns] = await Promise.all([
 *   loadGTFSFromUrl("gtfs.zip").then(feed => toGtfsData(feed, stops)),
 *   loadTransferPatternsFromUrl("transfer-patterns.br", { stops })
 * ]);
 *
 * const query = createQuery(gtfs, patterns, stops);
 * ```
 */
export function createQuery(
  gtfs: GtfsData,
  patterns: TransferPatternRepository,
  stops: StopTable,
  filters: JourneyFilter[] = [new MultipleCriteriaFilter()]
): DepartAfterQuery {
  const factory = new TransferPatternFactory(
    patterns,
    new TimetableLegRepository(gtfs.trips, stops),
    new TransferRepository(gtfs.transfers),
    gtfs.interchange
  );

  return new DepartAfterQuery(new TransferPatternPlanner(factory), new JourneyFactory(), stops, filters);
}
