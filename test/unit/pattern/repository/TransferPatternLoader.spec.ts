import { describe, expect, it } from "vitest";
import { type PatternPath, readPatterns } from "../../../../src/pattern/repository/PatternFormat.js";
import {
  loadTransferPatterns, loadTransferPatternsFromUrl, toLines
} from "../../../../src/pattern/repository/TransferPatternLoader.js";
import type { TransferPatternRepository } from "../../../../src/pattern/repository/TransferPatternRepository.js";
import { type StopTable, stopTable } from "../../../../src/StopTable.js";
import { at, named } from "../../util.js";

/**
 * The lines below are the file as `npm run patterns` writes it, spelled out rather than produced by the code
 * that reads them back. They are what pins this to the format: a line says how many leading
 * stations it takes from the line above it, then the stations that follow, three characters each.
 *
 *   0LSTCBGELYNRW   the whole pattern, sharing nothing with the line above
 *   2NRW            LST CBG, then NRW      -> LST CBG NRW
 *   1NRW            LST, then NRW          -> LST NRW
 */
const LONDON_TO_NORWICH = ["0LSTCBGELYNRW", "2NRW", "1NRW"];

describe("readPatterns", () => {

  it("takes the stations a line does not repeat from the line above it", async () => {
    const paths: PatternPath[] = [];

    for await (const path of readPatterns(LONDON_TO_NORWICH)) {
      paths.push(path);
    }

    expect(paths).toEqual([
      ["LST", "CBG", "ELY", "NRW"],
      ["LST", "CBG", "NRW"],
      ["LST", "NRW"]
    ]);
  });

  it("counts shared stations past nine into the characters above it", async () => {
    const deep = ["0AAABBBCCCDDDEEEFFFGGGHHHIIIJJJKKK", ":ZZZ"];
    const paths: PatternPath[] = [];

    for await (const path of readPatterns(deep)) {
      paths.push(path);
    }

    // ":" is one past "9", so ten stations are shared
    expect(paths[1]).toEqual(["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG", "HHH", "III", "JJJ", "ZZZ"]);
  });

});

describe("toLines", () => {

  it("puts a line back together across the chunks it arrived in", async () => {
    const lines = await collect(toLines(chunks("0LSTC", "BGELYNR", "W\n2NRW\n")));

    expect(lines).toEqual(["0LSTCBGELYNRW", "2NRW"]);
  });

  it("keeps a station code split across two chunks whole", async () => {
    const bytes = new TextEncoder().encode("0LSTNRW\n");
    const lines = await collect(toLines(chunks(bytes.slice(0, 3), bytes.slice(3))));

    expect(lines).toEqual(["0LSTNRW"]);
  });

  it("yields a last line the file did not end with a newline", async () => {
    expect(await collect(toLines(chunks("0LSTNRW")))).toEqual(["0LSTNRW"]);
  });

  it("reads a file written with carriage returns", async () => {
    expect(await collect(toLines(chunks("0LSTNRW\r\n2NRW\r\n")))).toEqual(["0LSTNRW", "2NRW"]);
  });

});

describe("loadTransferPatterns", () => {

  it("decompresses the file the way a browser can", async () => {
    const stops = stopTable();
    const repository = await loadTransferPatterns(await brotli(`${LONDON_TO_NORWICH.join("\n")}\n`), { stops });

    expect(londonToNorwich(repository, stops)).toEqual([[], ["CBG"], ["CBG", "ELY"]]);
  });

  it("reads bytes the transport has already decoded", async () => {
    const plain = new TextEncoder().encode(`${LONDON_TO_NORWICH.join("\n")}\n`);
    const stops = stopTable();
    const repository = await loadTransferPatterns(plain, { compressed: false, stops });

    expect(londonToNorwich(repository, stops)).toEqual([[], ["CBG"], ["CBG", "ELY"]]);
  });

  it("does not decompress a response the browser decoded for it", async () => {
    const body = new Blob([`${LONDON_TO_NORWICH.join("\n")}\n`]);
    const response = new Response(body, { headers: { "content-encoding": "br" } });
    const stops = stopTable();
    const repository = await loadTransferPatterns(response, { stops });

    expect(londonToNorwich(repository, stops)).toEqual([[], ["CBG"], ["CBG", "ELY"]]);
  });

});

describe("loadTransferPatternsFromUrl", () => {

  it("fetches the file and reads it", async () => {
    const compressed = await brotli(`${LONDON_TO_NORWICH.join("\n")}\n`);
    const asked: string[] = [];
    const stops = stopTable();
    const repository = await loadTransferPatternsFromUrl("https://example.com/patterns.br", {
      stops,
      fetch: async (url) => {
        asked.push(String(url));
        return new Response(compressed);
      }
    });

    expect(asked).toEqual(["https://example.com/patterns.br"]);
    expect(londonToNorwich(repository, stops)).toEqual([[], ["CBG"], ["CBG", "ELY"]]);
  });

  it("says which file it could not fetch", async () => {
    const failing = loadTransferPatternsFromUrl("https://example.com/patterns.br", {
      fetch: async () => new Response("", { status: 404, statusText: "Not Found" })
    });

    await expect(failing).rejects.toThrow(/https:\/\/example.com\/patterns.br: 404 Not Found/);
  });

});

/**
 * The patterns the fixture holds, named again so the expectation can say what it means.
 */
function londonToNorwich(repository: TransferPatternRepository, stops: StopTable): string[][] {
  return named(stops, repository.getPatterns(at(stops, "LST"), at(stops, "NRW")));
}

async function* chunks(...parts: (string | Uint8Array)[]): AsyncGenerator<Uint8Array> {
  for (const part of parts) {
    yield typeof part === "string" ? new TextEncoder().encode(part) : part;
  }
}

async function collect(lines: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];

  for await (const line of lines) {
    out.push(line);
  }

  return out;
}

/**
 * The text brotli compressed, using only what a browser has, so the fixture is made the same way
 * the file is read back.
 */
async function brotli(text: string): Promise<Blob> {
  const format = "brotli" as unknown as CompressionFormat;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream(format));

  return new Response(stream).blob();
}
