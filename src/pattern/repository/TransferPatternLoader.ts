import { type GTFSSource, toChunks } from "@gb-transit/gtfs-loader";
import { StopTable } from "../../gtfs/StopTable.js";
import { InMemoryTransferPatternRepository } from "./InMemoryTransferPatternRepository.js";
import { readPatternTree } from "./PatternTree.js";

/**
 * Anything that can give the bytes of a transfer pattern file.
 *
 * The same sources the feed is read from, because the two are loaded the same way and usually at
 * the same time: a file stream in node, a fetch response in a browser, or the bytes themselves.
 */
export type PatternSource = GTFSSource;

/** See `brotli` below: the runtime takes this, the types have not caught up */
const BROTLI = "brotli" as unknown as CompressionFormat;

export interface LoadPatternOptions {
  /**
   * Whether the bytes are still brotli compressed. Defaults to true, except for a `Response` whose
   * `Content-Encoding` says the transport has already decoded it.
   */
  compressed?: boolean;
  /**
   * The table the stations are numbered in. Pass the one the feed is read against, so that the two
   * speak of a station the same way. One of its own is made where the patterns are read alone.
   */
  stops?: StopTable;
}

export interface FetchPatternOptions extends LoadPatternOptions {
  signal?: AbortSignal;
  headers?: HeadersInit;
  /** The fetch to use, for an environment that does not have one or for a test that fakes it */
  fetch?: typeof fetch;
}

/**
 * Read the transfer patterns for a whole feed from the file `npm run patterns` writes.
 *
 * The file is read as it arrives rather than after it has all been collected, so a 33MB national
 * file is being indexed while the rest of it is still downloading, and the text of it is never held
 * all at once.
 */
export async function loadTransferPatterns(
  source: PatternSource,
  options: LoadPatternOptions = {}
): Promise<InMemoryTransferPatternRepository> {
  const compressed = options.compressed ?? !alreadyDecoded(source);
  const stops = options.stops ?? new StopTable();

  return new InMemoryTransferPatternRepository(await readPatternTree(toLines(bytes(source, compressed)), stops));
}

/**
 * Fetch a pattern file and read it, parsing it as it downloads.
 *
 * The file has to be readable by the page, which for a browser means the host either serves it from
 * the same origin or sends an Access-Control-Allow-Origin header.
 *
 * A host that serves the file with `Content-Encoding: br` has it decoded by the browser before this
 * sees it, which is noticed rather than decompressing what is already plain.
 */
export async function loadTransferPatternsFromUrl(
  url: string | URL,
  options: FetchPatternOptions = {}
): Promise<InMemoryTransferPatternRepository> {
  const get = options.fetch ?? fetch;
  const response = await get(String(url), { signal: options.signal, headers: options.headers });

  if (!response.ok) {
    throw new Error(`Unable to fetch transfer patterns from ${url}: ${response.status} ${response.statusText}`);
  }

  return loadTransferPatterns(response, options);
}

/**
 * The lines of a stream of bytes.
 *
 * The decoder is told the chunks keep coming, so a station code split across two of them is still
 * one code rather than two replacement characters.
 */
export async function* toLines(chunks: AsyncIterable<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();

  let held = "";

  for await (const chunk of chunks) {
    held += decoder.decode(chunk, { stream: true });

    let at = held.indexOf("\n");

    while (at !== -1) {
      yield trimEnd(held.slice(0, at));
      held = held.slice(at + 1);
      at = held.indexOf("\n");
    }
  }

  held += decoder.decode();

  if (held !== "") {
    yield trimEnd(held);
  }
}

function trimEnd(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

function bytes(source: PatternSource, compressed: boolean): AsyncIterable<Uint8Array> {
  const chunks = toChunks(source);

  return compressed ? toChunks(toStream(chunks).pipeThrough(brotli())) : chunks;
}

/**
 * `DecompressionStream` is the one decompressor both node and the browser have, so the file is read
 * the same way in each and nothing here has to name a node module.
 *
 * The format is spelled "brotli" rather than the "br" of the Content-Encoding header. The published
 * types still list only the three formats the standard started with, so the name is asserted rather
 * than checked; node and the browsers have taken it since 2024.
 */
function brotli(): ReadableWritablePair<Uint8Array, Uint8Array> {
  try {
    return new DecompressionStream(BROTLI) as unknown as ReadableWritablePair<Uint8Array, Uint8Array>;
  }
  catch (cause) {
    throw new Error(
      "Transfer patterns are brotli compressed, which this environment cannot decompress. Serve the " +
      "file with Content-Encoding: br so the transport decodes it, or pass { compressed: false } if " +
      "it is already plain.",
      { cause }
    );
  }
}

/**
 * A stream over the chunks, so that they can be piped through a decompressor. `ReadableStream.from`
 * would do this, but it is newer than the rest of what this relies on.
 */
function toStream(chunks: AsyncIterable<Uint8Array>): ReadableStream<Uint8Array> {
  const iterator = chunks[Symbol.asyncIterator]();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await iterator.next();

      if (done) {
        controller.close();
      }
      else {
        controller.enqueue(value);
      }
    },
    async cancel(reason) {
      await iterator.return?.(reason);
    }
  });
}

/**
 * Whether the bytes have already been decompressed on the way in. A browser given
 * `Content-Encoding: br` decodes the body itself but leaves the header saying so.
 */
function alreadyDecoded(source: PatternSource): boolean {
  return source instanceof Response && /\bbr\b/i.test(source.headers.get("content-encoding") ?? "");
}
