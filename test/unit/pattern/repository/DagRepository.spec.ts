import { describe, expect, it } from "vitest";
import { NO_NODE } from "../../../../src/pattern/repository/PatternNodes.js";
import { StationDag } from "../../../../src/pattern/repository/StationDag.js";
import { DagRepository } from "../../../../src/pattern/repository/DagRepository.js";

const LST = 0;
const CBG = 1;
const ELY = 2;
const NRW = 3;

/**
 * The tree these three patterns describe, built by hand so that what is being asked of it is not
 * hidden behind a file:
 *
 *   node    0     1     2     3     4     5
 *   stop  LST   CBG   ELY   NRW   NRW   NRW
 *   parent -1     0     1     2     1     0
 *
 * which is LST CBG ELY NRW, LST CBG NRW and LST NRW, all filed under LST reaching NRW.
 */
function londonToNorwich(): DagRepository {
  return new DagRepository(
    Uint16Array.from([LST, CBG, ELY, NRW, NRW, NRW]),
    Int32Array.from([NO_NODE, 0, 1, 2, 1, 0]),
    [StationDag.of(new Map([[NRW, [3, 4, 5]]]))]
  );
}

describe("DagRepository", () => {

  it("returns the stations between the ends, shortest pattern first", () => {
    expect(londonToNorwich().getPatterns(LST, NRW)).toEqual([[], [CBG], [CBG, ELY]]);
  });

  it("reads a pattern backwards for a journey the other way round", () => {
    expect(londonToNorwich().getPatterns(NRW, LST)).toEqual([[], [CBG], [ELY, CBG]]);
  });

  it("gives nothing for a pair it holds no pattern for", () => {
    expect(londonToNorwich().getPatterns(LST, ELY)).toEqual([]);
  });

  it("gives nothing for a station it has never heard of", () => {
    expect(londonToNorwich().getPatterns(99, NRW)).toEqual([]);
  });

  it("reads a direct pattern as no stations between the ends", () => {
    const tree = new DagRepository(
      Uint16Array.from([LST, NRW]),
      Int32Array.from([NO_NODE, 0]),
      [StationDag.of(new Map([[NRW, [1]]]))]
    );

    expect(tree.getPatterns(LST, NRW)).toEqual([[]]);
  });

});
