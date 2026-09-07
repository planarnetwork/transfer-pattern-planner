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

/**
 * A query over a feed and the transfer patterns for it.
 *
 * Both are loaded the same way wherever this runs, so this is all the wiring there is between
 * having them and being able to plan:
 *
 * ```
 * const [gtfs, patterns] = await Promise.all([
 *   loadGTFSFromUrl("gtfs.zip").then(toGtfsData),
 *   loadTransferPatternsFromUrl("transfer-patterns.br")
 * ]);
 *
 * const query = createQuery(gtfs, patterns);
 * ```
 */
export function createQuery(
  gtfs: GtfsData,
  patterns: TransferPatternRepository,
  filters: JourneyFilter[] = [new MultipleCriteriaFilter()]
): DepartAfterQuery {
  const factory = new TransferPatternFactory(
    patterns,
    new TimetableLegRepository(gtfs.trips),
    new TransferRepository(gtfs.transfers),
    gtfs.interchange
  );

  return new DepartAfterQuery(new TransferPatternPlanner(factory), new JourneyFactory(), filters);
}
