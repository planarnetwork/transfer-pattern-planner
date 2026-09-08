import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { StationPatternFiles } from "../../../src/generate/StationPatternFiles.js";
import { PatternReader } from "../../../src/pattern/format/PatternReader.js";

const made: string[] = [];

function temp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "station-files-test-"));

  made.push(dir);

  return dir;
}

/** the patterns of one station's file, as the stations each calls at */
async function patternsIn(directory: string, station: string): Promise<string[][]> {
  const text = zlib.brotliDecompressSync(fs.readFileSync(path.join(directory, `${station}.br`))).toString();
  const paths: string[][] = [];

  for await (const path of new PatternReader().read(text.split("\n"))) {
    paths.push(path);
  }

  return paths;
}

async function write(lines: string[]): Promise<string> {
  const out = temp();

  await new StationPatternFiles(temp(), new PatternReader()).write(lines, out);

  return out;
}

afterEach(() => {
  for (const dir of made.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("StationPatternFiles", () => {

  it("writes a pattern to the files of both stations it runs between", async () => {
    const out = await write(["0LSTCBGNRW"]);

    expect(await patternsIn(out, "LST")).toEqual([["LST", "CBG", "NRW"]]);
    expect(await patternsIn(out, "NRW")).toEqual([["NRW", "CBG", "LST"]]);
  });

  it("does not write a file for a station a pattern only passes through", async () => {
    const out = await write(["0LSTCBGNRW"]);

    expect(fs.readdirSync(out).sort()).toEqual(["LST.br", "NRW.br"]);
  });

  it("puts every pattern of a station in its file, whichever end it was written under", async () => {
    // LST to NRW, and EDB to LST: LST is the first station of one and the last of the other
    const out = await write(["0EDBLST", "0LSTNRW"]);

    expect(await patternsIn(out, "LST")).toEqual([["LST", "EDB"], ["LST", "NRW"]]);
  });

  it("orders a station's patterns so they can be front coded", async () => {
    const out = await write(["0LSTNRW", "1CBGNRW", "0EDBLST"]);
    const lst = await patternsIn(out, "LST");

    expect(lst.map(p => p.join(""))).toEqual([...lst.map(p => p.join(""))].sort());
  });

  it("writes a pattern found under both ends only once", async () => {
    const out = await write(["0LSTNRW", "0LSTNRW"]);

    expect(await patternsIn(out, "LST")).toEqual([["LST", "NRW"]]);
  });

  it("reports what it wrote", async () => {
    const files = new StationPatternFiles(temp(), new PatternReader());
    const { stations, bytes } = await files.write(["0LSTCBGNRW"], temp());

    expect(stations).toBe(2);
    expect(bytes).toBeGreaterThan(0);
  });

  it("clears up after itself", async () => {
    const work = temp();

    await new StationPatternFiles(work, new PatternReader()).write(["0LSTCBGNRW"], temp());

    expect(fs.readdirSync(work)).toEqual([]);
  });

});
