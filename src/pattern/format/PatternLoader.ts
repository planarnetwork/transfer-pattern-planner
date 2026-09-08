import { type GTFSSource, toChunks } from "@gb-transit/gtfs-loader";
import type { StopTable } from "../../gtfs/StopTable.js";
import { type PatternCompression, type PatternEncoding, encodingOf } from "./PatternFormat.js";
import { TransferTreeBuilder } from "./TransferTreeBuilder.js";
import type { TransferTreeRepository } from "../repository/TransferTreeRepository.js";

/**
 * Anything that can give the bytes of a transfer pattern file: the same sources the feed is read
 * from, because the two are loaded the same way and usually at the same time.
 */
export type PatternSource = GTFSSource;

/** See `decompressor` below: the runtime takes this, the types have not caught up */
const BROTLI = "brotli" as unknown as CompressionFormat;

/**
 * How much of the front of a file to look at before deciding what it is. A line or two of a plain
 * file, which is far more than a compressed one needs to give itself away.
 */
const SNIFF_WIDTH = 64;

export interface LoadPatternOptions {
  /**
   * Whether the bytes are still compressed. This is worked out from the bytes themselves, so it is
   * only worth passing where that is somehow wrong: false reads them as they are, true decompresses
   * them.
   */
  compressed?: boolean;
}

export interface FetchPatternOptions extends LoadPatternOptions {
  signal?: AbortSignal;
  headers?: HeadersInit;
  /** The fetch to use, for an environment that does not have one or for a test that fakes it */
  fetch?: typeof fetch;
}

/**
 * Reads the transfer patterns for a whole feed from the file `npm run patterns` writes.
 *
 * The stations are numbered in the table this is given, which is the one the feed is read against,
 * so the two speak of a station the same way. The file is read as it arrives rather than after it
 * has all been collected, so a 33MB national file is being indexed while the rest is downloading.
 */
export class PatternLoader {

  constructor(
    private readonly stops: StopTable
  ) {}

  public async load(source: PatternSource, options: LoadPatternOptions = {}): Promise<TransferTreeRepository> {
    return new TransferTreeBuilder(this.stops).read(this.lines(source, options));
  }

  /**
   * The lines of a pattern file, decompressed: what `load` reads before it builds anything, for
   * something that wants the file rather than a repository over it.
   */
  public lines(source: PatternSource, options: LoadPatternOptions = {}): AsyncIterable<string> {
    return this.toLines(this.bytes(source, options.compressed));
  }

  /**
   * Fetch a pattern file and read it as it downloads.
   *
   * The file has to be readable by the page, which for a browser means the host either serves it
   * from the same origin or sends an Access-Control-Allow-Origin header.
   */
  public async loadFromUrl(url: string | URL, options: FetchPatternOptions = {}): Promise<TransferTreeRepository> {
    const get = options.fetch ?? fetch;
    const response = await get(String(url), { signal: options.signal, headers: options.headers });

    if (!response.ok) {
      throw new Error(`Unable to fetch transfer patterns from ${url}: ${response.status} ${response.statusText}`);
    }

    return this.load(response, options);
  }

  /**
   * The lines of a stream of bytes. The decoder is told the chunks keep coming, so a station code
   * split across two of them is one code rather than two replacement characters.
   */
  private async *toLines(chunks: AsyncIterable<Uint8Array>): AsyncGenerator<string> {
    const decoder = new TextDecoder();

    let held = "";

    for await (const chunk of chunks) {
      held += decoder.decode(chunk, { stream: true });

      let at = held.indexOf("\n");

      while (at !== -1) {
        yield this.trimEnd(held.slice(0, at));
        held = held.slice(at + 1);
        at = held.indexOf("\n");
      }
    }

    held += decoder.decode();

    if (held !== "") {
      yield this.trimEnd(held);
    }
  }

  private trimEnd(line: string): string {
    return line.endsWith("\r") ? line.slice(0, -1) : line;
  }

  /**
   * The bytes of the file, decompressed if that is what they turn out to be.
   *
   * The front of the file is read before anything is decided, and given back to whatever reads it
   * next, so a stream is still read as it arrives rather than after it has all been collected.
   */
  private async *bytes(source: PatternSource, compressed?: boolean): AsyncGenerator<Uint8Array> {
    const chunks = toChunks(source)[Symbol.asyncIterator]();
    const head = await this.head(chunks);
    const file = this.rejoined(head, chunks);
    const encoding = this.encodingOf(head, compressed);

    if (encoding === "plain") {
      yield* file;
    }
    else {
      yield* toChunks(this.toStream(file).pipeThrough(this.decompressor(encoding)));
    }
  }

  /**
   * What the file is, from the bytes rather than from a header: a host that decompresses on the way
   * in leaves nothing behind saying that it did.
   *
   * `compressed` is still honoured where it is given, since a caller who knows what they have knows
   * better than a guess at the front of it. Saying a plain looking file is compressed leaves brotli,
   * which is what a file is written with and what the option used to mean.
   */
  private encodingOf(head: Uint8Array, compressed?: boolean): PatternEncoding {
    const found = encodingOf(head);

    if (compressed === false) {
      return "plain";
    }

    return compressed === true && found === "plain" ? "brotli" : found;
  }

  /** The first bytes of the file, from as many chunks as it takes to have enough to look at */
  private async head(chunks: AsyncIterator<Uint8Array>): Promise<Uint8Array> {
    const read = [] as Uint8Array[];
    let held = 0;

    while (held < SNIFF_WIDTH) {
      const { value, done } = await chunks.next();

      if (done) {
        break;
      }

      read.push(value);
      held += value.length;
    }

    const head = new Uint8Array(held);
    let at = 0;

    for (const chunk of read) {
      head.set(chunk, at);
      at += chunk.length;
    }

    return head;
  }

  /**
   * The whole file again: the bytes the sniff read, and then the rest of them. The delegation hands
   * a cancel on to the chunks it came from, so a fetch that is abandoned still stops.
   */
  private async *rejoined(head: Uint8Array, rest: AsyncIterator<Uint8Array>): AsyncGenerator<Uint8Array> {
    if (head.length > 0) {
      yield head;
    }

    yield* { [Symbol.asyncIterator]: () => rest };
  }

  /**
   * `DecompressionStream` is the one decompressor both node and the browser have, so the file is
   * read the same way in each and nothing here has to name a node module.
   *
   * Brotli is spelled "brotli" rather than the "br" of the Content-Encoding header, and the
   * published types still list only the three formats the standard started with - which are also
   * the only three a browser has, so a brotli file only reaches a page if its host decoded it.
   */
  private decompressor(compression: PatternCompression): ReadableWritablePair<Uint8Array, Uint8Array> {
    try {
      const format = compression === "gzip" ? "gzip" : BROTLI;

      return new DecompressionStream(format) as unknown as ReadableWritablePair<Uint8Array, Uint8Array>;
    }
    catch (cause) {
      throw new Error(
        `Transfer patterns are ${compression} compressed, which this environment cannot decompress. ` +
        "No browser has DecompressionStream(\"brotli\"), so a page needs the file either served with " +
        "Content-Encoding: br, which the browser decodes on the way in, or written with gzip, which " +
        "every environment can read.",
        { cause }
      );
    }
  }

  /**
   * A stream over the chunks, so they can be piped through a decompressor. `ReadableStream.from`
   * would do this, but it is newer than the rest of what this relies on.
   */
  private toStream(chunks: AsyncIterable<Uint8Array>): ReadableStream<Uint8Array> {
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

}
