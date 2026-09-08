import * as zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  BROTLI_QUALITY, checkCodeWidths, compressionFor, encodingOf, sharedStops
} from "../../../../src/pattern/format/PatternFormat.js";

describe("sharedStops", () => {

  it("reads the count a line begins with", () => {
    expect(sharedStops("0LSTNRW")).toBe(0);
    expect(sharedStops("2NRW")).toBe(2);
  });

  it("reads a count past nine from the characters above it", () => {
    // ":" is one past "9", and ";" the one after that
    expect(sharedStops(":ZZZ")).toBe(10);
    expect(sharedStops(";ZZZ")).toBe(11);
  });

});

describe("encodingOf", () => {

  const patterns = "0LSTCBGELYNRW\n2NRW\n1NRW\n";

  function head(bytes: Uint8Array | string): Uint8Array {
    const all = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;

    return all.slice(0, 64);
  }

  it("reads a file that is already plain", () => {
    expect(encodingOf(head(patterns))).toBe("plain");
  });

  it("reads a file written with carriage returns", () => {
    expect(encodingOf(head("0LSTCBGELYNRW\r\n2NRW\r\n"))).toBe("plain");
  });

  it("reads a line that has not ended yet", () => {
    expect(encodingOf(head("0LSTNRW"))).toBe("plain");
  });

  it("recognises brotli, whatever it was compressed at", () => {
    for (let quality = 0; quality <= 11; quality++) {
      const compressed = zlib.brotliCompressSync(Buffer.from(patterns.repeat(20)), {
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: quality }
      });

      expect(encodingOf(head(compressed))).toBe("brotli");
    }
  });

  it("recognises gzip", () => {
    expect(encodingOf(head(zlib.gzipSync(Buffer.from(patterns))))).toBe("gzip");
  });

  it("recognises the file this package writes", () => {
    const written = zlib.brotliCompressSync(Buffer.from(patterns), {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY }
    });

    expect(encodingOf(head(written))).toBe("brotli");
  });

  it("has nothing to decompress in nothing at all", () => {
    expect(encodingOf(new Uint8Array(0))).toBe("plain");
  });

});

describe("compressionFor", () => {

  it("gzips a file named for it, which is what a browser can decompress", () => {
    expect(compressionFor("transfer-patterns.gz")).toBe("gzip");
    expect(compressionFor(".gz")).toBe("gzip");
  });

  it("writes brotli otherwise", () => {
    expect(compressionFor("transfer-patterns.br")).toBe("brotli");
    expect(compressionFor(".br")).toBe("brotli");
  });

});

describe("checkCodeWidths", () => {

  it("passes stations a line can be read back with", () => {
    expect(() => checkCodeWidths(["NRW", "LST"])).not.toThrow();
  });

  it("rejects a station code of the wrong width", () => {
    expect(() => checkCodeWidths(["NRW", "PADDINGTON"])).toThrow(/3 character station codes/);
  });

  it("says how many are wrong and names the first of them", () => {
    expect(() => checkCodeWidths(["NRW", "PADDINGTON", "EU"]))
      .toThrow(/2 of 3 are a different length, starting with "PADDINGTON", "EU"/);
  });

});
