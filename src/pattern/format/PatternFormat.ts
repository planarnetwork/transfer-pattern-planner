import type { StopID } from "@gb-transit/gtfs-loader";

/** Characters in a station code. Every code is this wide, so a line is cut up rather than split */
export const CODE_WIDTH = 3;

/**
 * The character a shared count of nothing is written as. Counting up from it rather than writing a
 * digit means a count above nine carries on past `9` instead of overflowing, and a national feed
 * holds patterns of fourteen stations.
 */
export const NONE_SHARED = "0".charCodeAt(0);

/** How many leading stations a line takes from the line before it */
export function sharedStops(line: string): number {
  return line.charCodeAt(0) - NONE_SHARED;
}

/** A code of another width would run into the one after it, and the whole line would come back wrong */
export function checkCodeWidths(stopIds: StopID[]): void {
  const wrong = stopIds.filter(stop => stop.length !== CODE_WIDTH);

  if (wrong.length > 0) {
    throw new Error(
      `Transfer patterns are written with ${CODE_WIDTH} character station codes, but ` +
      `${wrong.length} of ${stopIds.length} are a different length, starting with ` +
      `${wrong.slice(0, 5).map(stop => `"${stop}"`).join(", ")}`
    );
  }
}

/**
 * How hard a written file is compressed. Five is where brotli stops being free: it holds a few
 * hundred megabytes a second, where the levels above it manage single figures.
 */
export const BROTLI_QUALITY = 5;

/**
 * What a pattern file is compressed with. Brotli is the smaller of the two and is what a file is
 * written with by default; gzip is what a browser can decompress, since no browser has
 * `DecompressionStream("brotli")`.
 */
export type PatternCompression = "brotli" | "gzip";

/** What a pattern file turns out to hold: one of the two compressed forms, or the lines themselves */
export type PatternEncoding = PatternCompression | "plain";

/** What a file called this is compressed with. `.gz` is gzip and anything else is brotli */
export function compressionFor(name: string): PatternCompression {
  return name.endsWith(".gz") ? "gzip" : "brotli";
}

/**
 * What the bytes at the front of a pattern file say it is, which is worth more than what its host
 * says: a browser given `Content-Encoding: br` decodes the body and then removes the header, so
 * nothing downstream can tell from the response that it is already plain.
 *
 * A plain file is lines of front coded ASCII, so it begins with a count and carries on in printable
 * characters until the first newline. Neither compressed form starts like that: gzip has two magic
 * bytes of its own, and a brotli stream reaches an unprintable byte within a character or two.
 */
export function encodingOf(head: Uint8Array): PatternEncoding {
  if (head[0] === 0x1f && head[1] === 0x8b && head[2] === 0x08) {
    return "gzip";
  }

  return looksPlain(head) ? "plain" : "brotli";
}

function looksPlain(head: Uint8Array): boolean {
  // nothing to decompress, and nothing to read either
  if (head.length === 0) {
    return true;
  }

  // the first line of a file shares nothing with the line above it, so its count is a digit
  const shared = (head[0] ?? 0) - NONE_SHARED;

  if (shared < 0 || shared > 9) {
    return false;
  }

  for (const byte of head) {
    // the end of the first line, however the file writes it
    if (byte === 0x0a || byte === 0x0d) {
      return true;
    }

    if (byte < 0x20 || byte > 0x7e) {
      return false;
    }
  }

  return true;
}

/**
 * A name for the working file of a station or a bucket, from its character codes rather than from
 * itself, so a code that is not a filename stays one and two of them never share a file.
 */
export function workFileName(key: string): number {
  let name = 0;

  for (let i = 0; i < key.length; i++) {
    name = (name << 8) | key.charCodeAt(i);
  }

  return name;
}
