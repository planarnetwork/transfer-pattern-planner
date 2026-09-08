import { once } from "node:events";
import * as fs from "node:fs";
import { pipeline } from "node:stream/promises";
import * as zlib from "node:zlib";

/**
 * Writes transfer patterns to a file, one line per pattern.
 *
 * The lines are not in any order, since a station is planned whenever a worker gets to it, and
 * they are not yet folded into a tree: that needs every pattern the run finds, so it is left to
 * TransferPatternMerge once the last station is done.
 */
export class TransferPatternFile {

  private readonly patterns = zlib.createGzip();
  private readonly written: Promise<void>;

  constructor(file: string) {
    this.written = pipeline(this.patterns, fs.createWriteStream(file));
  }

  /**
   * Write the lines of one station's patterns.
   *
   * It only waits on the file where it has fallen far enough behind to say so, since planning the
   * next station takes far longer than writing the last one's lines.
   */
  public async store(lines: string[]): Promise<void> {
    if (lines.length > 0 && !this.patterns.write(`${lines.join("\n")}\n`)) {
      await once(this.patterns, "drain");
    }
  }

  /**
   * Finish the file. Nothing has reached the disk for certain until this resolves, so a worker
   * cannot be stopped before it does.
   */
  public async close(): Promise<void> {
    this.patterns.end();

    await this.written;
  }

}
