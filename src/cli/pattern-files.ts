import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { StationPatternFiles } from "../generate/StationPatternFiles.js";
import { StopTable } from "../gtfs/StopTable.js";
import { PatternLoader } from "../pattern/format/PatternLoader.js";
import { PatternReader } from "../pattern/format/PatternReader.js";

/**
 * Turn the file `npm run patterns` writes into one file per station, for a planner that reads a
 * station when it is asked about rather than holding the feed.
 */
async function run(patterns: string, directory: string, extension: string) {
  console.log(`Reading ${patterns}`);

  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "station-patterns-"));
  // only the lines are wanted here, so the table this would number stations in goes unused
  const lines = new PatternLoader(new StopTable()).lines(fs.createReadStream(patterns));
  const files = new StationPatternFiles(workDir, new PatternReader(), extension);

  try {
    const { stations, bytes } = await files.write(lines, directory);

    console.log(`${stations.toLocaleString()} stations, ${(bytes / 1024 / 1024).toFixed(1)}MB in ${directory}`);
  }
  finally {
    await fs.promises.rm(workDir, { recursive: true, force: true });
  }
}

if (process.argv[2] && process.argv[3]) {
  run(process.argv[2], process.argv[3], process.argv[4] ?? ".br")
    .catch(e => { console.error(e); process.exit(1); });
}
else {
  console.log(
    "Please specify a transfer pattern file and a directory to write the stations to, and " +
    "optionally what to call each file: .br for brotli, or .gz for the gzip a browser can read."
  );
}
