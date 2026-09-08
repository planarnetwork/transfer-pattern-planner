import * as zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { StopTable } from "../../../../src/gtfs/StopTable.js";
import type { PatternProvider } from "../../../../src/pattern/format/PatternProvider.js";
import { LazyTransferTreeRepository } from "../../../../src/pattern/repository/LazyTransferTreeRepository.js";
import { at, named } from "../../util.js";

/**
 * A station's file holds every pattern that touches it, turned round so each line starts with it.
 * LST reaches NRW three ways; NRW's own file says the same three the other way about.
 */
const FILES: Record<string, string[]> = {
  LST: ["0LSTCBGELYNRW", "2NRW", "1NRW"],
  NRW: ["0NRWCBGLST", "1ELYCBGLST", "1LST"]
};

function provider(files: Record<string, string[]> = FILES): PatternProvider & { asked: string[] } {
  const asked: string[] = [];

  return {
    asked,
    async get(station: string) {
      asked.push(station);

      return files[station] && zlib.brotliCompressSync(Buffer.from(`${files[station].join("\n")}\n`));
    }
  };
}

describe("LazyTransferTreeRepository", () => {

  it("reads a station when it is prepared and answers from what it read", async () => {
    const stops = new StopTable();
    const p = provider();
    const patterns = new LazyTransferTreeRepository(p, stops);

    await patterns.prepare([stops.intern("LST")]);

    expect(named(stops, patterns.getPatterns(at(stops, "LST"), at(stops, "NRW"))))
      .toEqual([[], ["CBG"], ["CBG", "ELY"]]);
    expect(p.asked).toEqual(["LST"]);
  });

  it("answers a journey the other way round from that station's own file", async () => {
    const stops = new StopTable();
    const patterns = new LazyTransferTreeRepository(provider(), stops);

    await patterns.prepare([stops.intern("NRW")]);

    expect(named(stops, patterns.getPatterns(at(stops, "NRW"), at(stops, "LST"))))
      .toEqual([[], ["CBG"], ["ELY", "CBG"]]);
  });

  it("reads a station once, however many times it is prepared", async () => {
    const stops = new StopTable();
    const p = provider();
    const patterns = new LazyTransferTreeRepository(p, stops);

    await patterns.prepare([stops.intern("LST"), stops.intern("LST")]);
    await patterns.prepare([stops.intern("LST")]);

    expect(p.asked).toEqual(["LST"]);
  });

  it("gives nothing for a station the feed runs nothing from", async () => {
    const stops = new StopTable();
    const patterns = new LazyTransferTreeRepository(provider(), stops);
    const nowhere = stops.intern("ZZZ");

    await patterns.prepare([nowhere]);

    expect(patterns.getPatterns(nowhere, stops.intern("LST"))).toEqual([]);
  });

  it("refuses to answer for a station it was never asked to read", async () => {
    // returning nothing would come back as a journey that does not exist rather than as a fault
    const stops = new StopTable();
    const patterns = new LazyTransferTreeRepository(provider(), stops);

    expect(() => patterns.getPatterns(stops.intern("LST"), stops.intern("NRW")))
      .toThrow(/patterns for LST have not been read/);
  });

  it("forgets the station asked for longest ago when the room runs out", async () => {
    const stops = new StopTable();
    const p = provider({ ...FILES, EDB: ["0EDBGLQ"] });
    const patterns = new LazyTransferTreeRepository(p, stops, 2);

    await patterns.prepare([stops.intern("LST")]);
    await patterns.prepare([stops.intern("NRW")]);
    await patterns.prepare([stops.intern("EDB")]);
    await patterns.prepare([stops.intern("LST")]);

    // LST went when EDB arrived, so it had to be read a second time
    expect(p.asked).toEqual(["LST", "NRW", "EDB", "LST"]);
  });

  it("keeps a station that is asked for again", async () => {
    const stops = new StopTable();
    const p = provider({ ...FILES, EDB: ["0EDBGLQ"] });
    const patterns = new LazyTransferTreeRepository(p, stops, 2);

    await patterns.prepare([stops.intern("LST")]);
    await patterns.prepare([stops.intern("NRW")]);
    await patterns.prepare([stops.intern("LST")]);   // asked for again, so NRW is now the oldest
    await patterns.prepare([stops.intern("EDB")]);
    await patterns.prepare([stops.intern("LST")]);

    expect(p.asked).toEqual(["LST", "NRW", "EDB"]);
  });

  it("does not drop a station the query being prepared is asking for", async () => {
    const stops = new StopTable();
    const patterns = new LazyTransferTreeRepository(provider({ ...FILES, EDB: ["0EDBGLQ"] }), stops, 2);
    const [lst, nrw, edb] = ["LST", "NRW", "EDB"].map(code => stops.intern(code));

    await patterns.prepare([lst]);
    await patterns.prepare([nrw]);
    await patterns.prepare([lst, edb]);

    expect(() => patterns.getPatterns(lst, edb)).not.toThrow();
  });

  it("holds a group larger than the limit for as long as the query needs it", async () => {
    const stops = new StopTable();
    const patterns = new LazyTransferTreeRepository(provider({ ...FILES, EDB: ["0EDBGLQ"] }), stops, 1);
    const wanted = ["LST", "NRW", "EDB"].map(code => stops.intern(code));

    await patterns.prepare(wanted);

    for (const origin of wanted) {
      expect(() => patterns.getPatterns(origin, stops.intern("GLQ"))).not.toThrow();
    }
  });

  it("reads a station once when two queries ask for it at the same time", async () => {
    const stops = new StopTable();
    const p = provider();
    const patterns = new LazyTransferTreeRepository(p, stops);
    const lst = stops.intern("LST");

    await Promise.all([patterns.prepare([lst]), patterns.prepare([lst])]);

    expect(p.asked).toEqual(["LST"]);
  });

});
