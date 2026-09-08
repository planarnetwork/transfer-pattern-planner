import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { TransferPatternMerge } from "../../../src/generate/TransferPatternMerge.js";
import { CODE_WIDTH, sharedStops } from "../../../src/pattern/format/PatternFormat.js";

const made: string[] = [];

async function workDir(): Promise<string> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "merge-patterns-test-"));

  made.push(dir);

  return dir;
}

function part(dir: string, name: string, lines: string[]): string {
  const file = path.join(dir, name);

  fs.writeFileSync(file, zlib.gzipSync(`${lines.join("\n")}\n`));

  return file;
}

/**
 * The patterns of the merged file, in the order it wrote them, which is what the merge is for.
 * Spelled out here rather than read by the loader, so the file is checked and not the reader.
 */
function paths(output: string): string[][] {
  const text = zlib.brotliDecompressSync(fs.readFileSync(output)).toString();
  const paths: string[][] = [];

  let previous: string[] = [];

  for (const line of text.split("\n")) {
    if (line === "") {
      continue;
    }

    const path = previous.slice(0, sharedStops(line));

    for (let at = 1; at < line.length; at += CODE_WIDTH) {
      path.push(line.slice(at, at + CODE_WIDTH));
    }

    paths.push(path);
    previous = path;
  }

  return paths;
}

afterEach(async () => {
  await Promise.all(made.splice(0).map(dir => fs.promises.rm(dir, { recursive: true, force: true })));
});

describe("TransferPatternMerge", () => {

  it("puts every pattern in order", async () => {
    const dir = await workDir();
    const output = path.join(dir, "out.br");
    const parts = [
      part(dir, "a.gz", ["NRWCBGLST", "NRWLST", "BHMNCLEDB"]),
      part(dir, "b.gz", ["BHMEDB", "NRWCBGBFRLST"])
    ];

    const { patterns } = await new TransferPatternMerge(dir).merge(parts, output);

    expect(patterns).toBe(5);
    expect(paths(output)).toEqual([
      ["BHM", "EDB"],
      ["BHM", "NCL", "EDB"],
      ["NRW", "CBG", "BFR", "LST"],
      ["NRW", "CBG", "LST"],
      ["NRW", "LST"]
    ]);
  });

  it("keeps one copy of a pattern found from both ends", async () => {
    const dir = await workDir();
    const output = path.join(dir, "out.br");
    const parts = [
      part(dir, "a.gz", ["BHMNRW", "BHMEUSNRW"]),
      part(dir, "b.gz", ["BHMNRW", "BHMLSTNRW"])
    ];

    const { patterns } = await new TransferPatternMerge(dir).merge(parts, output);

    expect(patterns).toBe(3);
    expect(paths(output)).toEqual([
      ["BHM", "EUS", "NRW"],
      ["BHM", "LST", "NRW"],
      ["BHM", "NRW"]
    ]);
  });

  it("clears up after itself", async () => {
    const dir = await workDir();
    const output = path.join(dir, "out.br");

    await new TransferPatternMerge(dir).merge([part(dir, "a.gz", ["NRWLST"])], output);

    expect(fs.readdirSync(dir).filter(f => f.startsWith("patterns-"))).toEqual([]);
  });

  it("writes the gzip a browser can decompress for a file named for it", async () => {
    const dir = await workDir();
    const output = path.join(dir, "out.gz");

    await new TransferPatternMerge(dir).merge([part(dir, "a.gz", ["NRWCBGLST", "NRWLST"])], output);

    expect(zlib.gunzipSync(fs.readFileSync(output)).toString()).toBe("0NRWCBGLST\n1LST\n");
  });

  it("writes an empty file for no patterns", async () => {
    const dir = await workDir();
    const output = path.join(dir, "out.br");

    const { patterns } = await new TransferPatternMerge(dir).merge([part(dir, "a.gz", [])], output);

    expect(patterns).toBe(0);
    expect(paths(output)).toEqual([]);
  });

});
