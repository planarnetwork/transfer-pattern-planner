import * as fs from "node:fs";
import * as path from "node:path";
import type { StopID } from "@gb-transit/gtfs-loader";
import { checkCodeWidths } from "./PatternFormat.js";
import type { PatternProvider } from "./PatternProvider.js";

/**
 * A station's patterns from a file beside the others, named for it.
 */
export class DirectoryPatternProvider implements PatternProvider {

  constructor(
    private readonly directory: string,
    private readonly extension = ".br"
  ) {}

  public async get(station: StopID): Promise<Uint8Array | undefined> {
    // the station names the file, so anything but a station code would name another one
    checkCodeWidths([station]);

    try {
      return await fs.promises.readFile(path.join(this.directory, station + this.extension));
    }
    catch (error) {
      // a station the feed runs nothing from has no file, which is not a failure to read one
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }

      throw error;
    }
  }

}
