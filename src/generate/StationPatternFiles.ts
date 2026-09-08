import { once } from "node:events";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import type { Writable } from "node:stream";
import * as zlib from "node:zlib";
import { FrontCoder } from "../pattern/format/FrontCoder.js";
import type { PatternReader } from "../pattern/format/PatternReader.js";

/** Where brotli stops being free, as the merged file uses too */
const QUALITY = 5;

/**
 * Writes a file per station, holding every pattern that touches it.
 *
 * The merged file holds a pattern once, under whichever of its two ends sorts first, which is fine
 * to read from end to end and poor to read a station at a time: a query from a station late in the
 * alphabet would have to fetch a file per destination rather than one. Here a pattern is written
 * to both of its ends, so a query only ever needs the stations it departs from.
 *
 * That doubles what is stored, which matters when the whole of it is loaded and does not when a
 * station is.
 */
export class StationPatternFiles {

  constructor(
    private readonly workDir: string,
    private readonly reader: PatternReader
  ) {}

  public async write(lines: AsyncIterable<string> | Iterable<string>, directory: string): Promise<WrittenFiles> {
    await fs.promises.mkdir(directory, { recursive: true });

    const stations = await this.deal(lines);

    let bytes = 0;

    for (const station of stations) {
      bytes += await this.writeStation(station, directory);
      await fs.promises.rm(this.stationFile(station), { force: true });
    }

    return { stations: stations.length, bytes };
  }

  /**
   * Put every pattern under both of the stations it runs between, the second one turned round so
   * that every line of a station's file begins with it.
   */
  private async deal(lines: AsyncIterable<string> | Iterable<string>): Promise<string[]> {
    const files = new Map<string, fs.WriteStream>();

    for await (const stops of this.reader.read(lines)) {
      const reversed = [...stops].reverse();

      await this.append(files, stops[0], stops.join(""));
      await this.append(files, reversed[0], reversed.join(""));
    }

    await Promise.all([...files.values()].map(file => new Promise<void>(resolve => file.end(resolve))));

    return [...files.keys()].sort();
  }

  private async append(files: Map<string, fs.WriteStream>, station: string, line: string): Promise<void> {
    let file = files.get(station);

    if (file === undefined) {
      file = fs.createWriteStream(this.stationFile(station));
      files.set(station, file);
    }

    if (!file.write(`${line}\n`)) {
      await once(file, "drain");
    }
  }

  /**
   * One station's patterns, in order and front coded as the merged file is, so the same reader
   * makes sense of either.
   */
  private async writeStation(station: string, directory: string): Promise<number> {
    const seen = new Set<string>();
    const lines = readline.createInterface({
      input: fs.createReadStream(this.stationFile(station)),
      crlfDelay: Number.POSITIVE_INFINITY
    });

    for await (const line of lines) {
      if (line !== "") {
        seen.add(line);
      }
    }

    const coder = new FrontCoder();
    const coded = [...seen].sort().map(line => coder.code(line)).join("\n");
    const compressed = zlib.brotliCompressSync(Buffer.from(`${coded}\n`), {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: QUALITY }
    });

    await fs.promises.writeFile(path.join(directory, `${station}.br`), compressed);

    return compressed.length;
  }

  private stationFile(station: string): string {
    let name = 0;

    for (let i = 0; i < station.length; i++) {
      name = (name << 8) | station.charCodeAt(i);
    }

    return path.join(this.workDir, `station-${name}.txt`);
  }

}

export interface WrittenFiles {
  /** How many stations were written */
  stations: number;
  /** How large they are together */
  bytes: number;
}
