import { once } from "node:events";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import * as zlib from "node:zlib";
import { FrontCoder } from "../pattern/format/FrontCoder.js";
import { BROTLI_QUALITY, CODE_WIDTH, compressionFor, workFileName } from "../pattern/format/PatternFormat.js";

const gunzip = promisify(zlib.gunzip);

/**
 * Folds the files the workers wrote into one.
 *
 * The patterns have to be in order to be folded into a tree, and there are too many of them to
 * sort at once. They are dealt into a file per leading station first, which is a sort of the first
 * station and leaves each file small enough to sort on its own; reading those files back in order
 * then gives the whole run in order without ever holding all of it.
 *
 * The same pattern is found twice, once from each end of the journey, so sorting a file is also
 * where the duplicates go.
 */
export class TransferPatternMerge {

  constructor(
    private readonly workDir: string
  ) { }

  /**
   * Merge the given files into one, and return how many patterns it holds.
   *
   * The file is named for what it holds: an output ending `.gz` is gzipped, which is larger than
   * brotli and is what a browser can decompress, and anything else is brotli.
   */
  public async merge(inputs: string[], output: string): Promise<MergedPatterns> {
    const { buckets, bytes } = await this.deal(inputs);
    const compressed = this.compressor(output, bytes);
    const written = pipeline(compressed, fs.createWriteStream(output));

    let total = 0;

    for (const bucket of buckets) {
      const patterns = await this.patternsIn(bucket);

      total += patterns.length;

      // a coder per bucket: the buckets are written in order, but each starts a run of its own
      const coder = new FrontCoder();

      await this.write(compressed, patterns.map(line => coder.code(line)));
    }

    compressed.end();
    await written;

    for (const bucket of buckets) {
      await fs.promises.rm(this.bucketFile(bucket), { force: true });
    }

    return { patterns: total, bytes: (await fs.promises.stat(output)).size };
  }

  /**
   * Told roughly how much is coming, brotli picks settings for a file that size rather than for a
   * stream of unknown length, and the file comes out a fifth smaller
   */
  private compressor(output: string, sizeHint: number): zlib.Gzip | zlib.BrotliCompress {
    return compressionFor(output) === "gzip"
      ? zlib.createGzip()
      : zlib.createBrotliCompress({
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
          [zlib.constants.BROTLI_PARAM_SIZE_HINT]: Math.min(sizeHint, 0xffffffff)
        }
      });
  }

  /**
   * Deal every line into the file for the station it starts from, and return those stations in
   * order, which is the order their patterns belong in, with how many bytes were dealt.
   *
   * A bucket is the whole station rather than its first letter. Every line in it begins with that
   * station, so the buckets still concatenate in order, but a national feed spreads over 2,786 of
   * them rather than 26 - and it is one bucket at a time that patternsIn holds in memory.
   *
   * A worker's file is read whole and each bucket's share of it written at once. A stream written a
   * line at a time spends far longer on the writes than on anything written.
   */
  private async deal(inputs: string[]): Promise<DealtPatterns> {
    const files = new Map<string, fs.WriteStream>();

    let bytes = 0;

    for (const input of inputs) {
      const text = (await gunzip(await fs.promises.readFile(input))).toString();
      const lines = new Map<string, string[]>();

      bytes += text.length;

      for (const line of text.split("\n")) {
        if (line === "") {
          continue;
        }

        const bucket = line.slice(0, CODE_WIDTH);
        const bucketLines = lines.get(bucket);

        if (bucketLines === undefined) {
          lines.set(bucket, [line]);
        }
        else {
          bucketLines.push(line);
        }
      }

      for (const [bucket, bucketLines] of lines) {
        let file = files.get(bucket);

        if (file === undefined) {
          file = fs.createWriteStream(this.bucketFile(bucket));
          files.set(bucket, file);
        }

        await this.write(file, bucketLines);
      }
    }

    await Promise.all([...files.values()].map(file =>
      new Promise<void>(resolve => file.end(resolve))
    ));

    return { buckets: [...files.keys()].sort(), bytes };
  }

  /**
   * The distinct patterns dealt into a bucket, in the order they are written in.
   *
   * They are collected into a set as the file is read, since the same pattern is found once from
   * each end of the journey and there is nothing to be done with the second copy.
   */
  private async patternsIn(bucket: string): Promise<string[]> {
    const patterns = new Set<string>();

    for (const line of (await fs.promises.readFile(this.bucketFile(bucket), "utf8")).split("\n")) {
      if (line !== "") {
        patterns.add(line);
      }
    }

    return [...patterns].sort();
  }

  /**
   * Write the lines at once, waiting only where the stream has fallen far enough behind to say so
   */
  private async write(stream: Writable, lines: string[]): Promise<void> {
    if (lines.length > 0 && !stream.write(`${lines.join("\n")}\n`)) {
      await once(stream, "drain");
    }
  }

  private bucketFile(bucket: string): string {
    return path.join(this.workDir, `patterns-${workFileName(bucket)}.txt`);
  }

}

export interface MergedPatterns {
  /** How many distinct patterns the file holds */
  patterns: number;
  /** How large it is once compressed */
  bytes: number;
}

interface DealtPatterns {
  /** The leading stations of the patterns, in order */
  buckets: string[];
  /** How much was dealt, which is roughly how much will be compressed */
  bytes: number;
}
