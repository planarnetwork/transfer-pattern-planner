import { describe, expect, it } from "vitest";
import { StopTable } from "../../../../src/gtfs/StopTable.js";
import type { TransferTreeRepository } from "../../../../src/pattern/repository/TransferTreeRepository.js";
import { PatternLoader } from "../../../../src/pattern/format/PatternLoader.js";
import { at, named } from "../../util.js";

/**
 * The file as `npm run patterns` writes it, spelled out rather than produced by the code that reads
 * it back:
 *
 *   0LSTCBGELYNRW   the whole pattern, sharing nothing with the line above
 *   2NRW            LST CBG, then NRW      -> LST CBG NRW
 *   1NRW            LST, then NRW          -> LST NRW
 */
const LONDON_TO_NORWICH = "0LSTCBGELYNRW\n2NRW\n1NRW\n";

/** The patterns the fixture holds, named again so the expectation can say what it means */
function londonToNorwich(patterns: TransferTreeRepository, stops: StopTable): string[][] {
  return named(stops, patterns.getPatterns(at(stops, "LST"), at(stops, "NRW")));
}

async function* chunks(...parts: (string | Uint8Array)[]): AsyncGenerator<Uint8Array> {
  for (const part of parts) {
    yield typeof part === "string" ? new TextEncoder().encode(part) : part;
  }
}

/**
 * The text compressed, using only what a browser has, so the fixture is made the same way the file
 * is read back.
 */
async function compress(text: string, format: string): Promise<Blob> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream(format as CompressionFormat));

  return new Response(stream).blob();
}

function brotli(text: string): Promise<Blob> {
  return compress(text, "brotli");
}

function gzip(text: string): Promise<Blob> {
  return compress(text, "gzip");
}

describe("PatternLoader", () => {

  it("decompresses the file the way a browser can", async () => {
    const stops = new StopTable();
    const patterns = await new PatternLoader(stops).load(await brotli(LONDON_TO_NORWICH));

    expect(londonToNorwich(patterns, stops)).toEqual([[], ["CBG"], ["CBG", "ELY"]]);
  });

  it("decompresses a gzipped file, which is what a browser can decompress", async () => {
    const stops = new StopTable();
    const patterns = await new PatternLoader(stops).load(await gzip(LONDON_TO_NORWICH));

    expect(londonToNorwich(patterns, stops)).toEqual([[], ["CBG"], ["CBG", "ELY"]]);
  });

  it("reads bytes the transport has already decoded", async () => {
    const stops = new StopTable();
    const plain = new TextEncoder().encode(LONDON_TO_NORWICH);
    const patterns = await new PatternLoader(stops).load(plain, { compressed: false });

    expect(londonToNorwich(patterns, stops)).toEqual([[], ["CBG"], ["CBG", "ELY"]]);
  });

  /**
   * A host sending Content-Encoding: br has the browser decode the body on the way in, and then
   * take the header off the response it hands over, so there is nothing left to be told by.
   */
  it("does not decompress a response the browser decoded and said nothing about", async () => {
    const stops = new StopTable();
    const response = new Response(new Blob([LONDON_TO_NORWICH]), { headers: { "content-type": "text/plain" } });
    const patterns = await new PatternLoader(stops).load(response);

    expect(londonToNorwich(patterns, stops)).toEqual([[], ["CBG"], ["CBG", "ELY"]]);
  });

  it("decompresses a compressed response whatever its Content-Encoding says", async () => {
    const stops = new StopTable();
    const response = new Response(await brotli(LONDON_TO_NORWICH), { headers: { "content-encoding": "br" } });
    const patterns = await new PatternLoader(stops).load(response);

    expect(londonToNorwich(patterns, stops)).toEqual([[], ["CBG"], ["CBG", "ELY"]]);
  });

  it("takes the word of a caller who says the file is compressed", async () => {
    const plain = new TextEncoder().encode(LONDON_TO_NORWICH);
    const failing = new PatternLoader(new StopTable()).load(plain, { compressed: true });

    await expect(failing).rejects.toThrow();
  });

  it("decides on a file that arrives a byte at a time", async () => {
    const stops = new StopTable();
    const bytes = new Uint8Array(await (await brotli(LONDON_TO_NORWICH)).arrayBuffer());
    const patterns = await new PatternLoader(stops).load(chunks(...[...bytes].map(byte => new Uint8Array([byte]))));

    expect(londonToNorwich(patterns, stops)).toEqual([[], ["CBG"], ["CBG", "ELY"]]);
  });

  it("puts a line back together across the chunks it arrived in", async () => {
    const stops = new StopTable();
    const patterns = await new PatternLoader(stops)
      .load(chunks("0LSTC", "BGELYNR", "W\n2NRW\n1NRW\n"));

    expect(londonToNorwich(patterns, stops)).toEqual([[], ["CBG"], ["CBG", "ELY"]]);
  });

  it("keeps a station code split across two chunks whole", async () => {
    const stops = new StopTable();
    const bytes = new TextEncoder().encode("0LSTNRW\n");
    const patterns = await new PatternLoader(stops)
      .load(chunks(bytes.slice(0, 3), bytes.slice(3)));

    expect(londonToNorwich(patterns, stops)).toEqual([[]]);
  });

  it("reads a last line the file did not end with a newline", async () => {
    const stops = new StopTable();
    const patterns = await new PatternLoader(stops).load(chunks("0LSTNRW"));

    expect(londonToNorwich(patterns, stops)).toEqual([[]]);
  });

  it("reads a file written with carriage returns", async () => {
    const stops = new StopTable();
    const patterns = await new PatternLoader(stops)
      .load(chunks("0LSTCBGELYNRW\r\n2NRW\r\n1NRW\r\n"));

    expect(londonToNorwich(patterns, stops)).toEqual([[], ["CBG"], ["CBG", "ELY"]]);
  });

  it("says which file it could not fetch", async () => {
    const failing = new PatternLoader(new StopTable()).loadFromUrl("https://example.com/patterns.br", {
      fetch: async () => new Response("", { status: 404, statusText: "Not Found" })
    });

    await expect(failing).rejects.toThrow(/https:\/\/example.com\/patterns.br: 404 Not Found/);
  });

  it("fetches the file and reads it", async () => {
    const stops = new StopTable();
    const compressed = await brotli(LONDON_TO_NORWICH);
    const asked: string[] = [];

    const patterns = await new PatternLoader(stops).loadFromUrl("https://example.com/patterns.br", {
      fetch: async (url) => {
        asked.push(String(url));

        return new Response(compressed);
      }
    });

    expect(asked).toEqual(["https://example.com/patterns.br"]);
    expect(londonToNorwich(patterns, stops)).toEqual([[], ["CBG"], ["CBG", "ELY"]]);
  });

});
