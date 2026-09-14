import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { Worker } from "node:worker_threads";
import { CSVParser, entityTypeOf, loadGTFS, readZip, toChunks } from "@gb-transit/gtfs-loader";
import type { StopID } from "@gb-transit/gtfs-loader";
import { loadGtfs } from "connection-scan-algorithm";
import ProgressBar from "progress";
import { createNetwork } from "raptor-journey-planner";
import { shareTimetable } from "../generate/SharedTimetable.js";
import { TransferPatternMerge } from "../generate/TransferPatternMerge.js";
import { checkCodeWidths } from "../pattern/format/PatternFormat.js";
import type { Algorithm, WorkerInput, WorkerTimetable } from "./transfer-pattern-worker.js";

/**
 * Whether the timetable can be shared with a worker rather than copied to it. Both algorithms'
 * timetables are allocated on SharedArrayBuffers where they exist.
 */
const canShareMemory = typeof SharedArrayBuffer !== "undefined";

/**
 * The worker, beside this file. A Worker is given an exact file rather than a module to resolve, so
 * the extension has to be settled here, and this only ever runs from source: the cli is not built.
 */
const WORKER = new URL("transfer-pattern-worker.ts", import.meta.url);

/**
 * Build the timetable once and give it to every worker, rather than every worker building its own.
 *
 * The timetable is allocated on SharedArrayBuffers, so it crosses to a worker as shared memory. A
 * worker that only makes transfer patterns needs nothing else of any size: the feed it was built
 * from is hundreds of megabytes and is only needed to name a journey's stop times, which a pattern
 * does not carry.
 */
async function run(filename: string, dateString: string, output: string, algorithm: Algorithm) {
  const date = new Date(dateString);
  const stops = await getStops(filename);

  console.log(`Loading ${filename}`);

  const timetable = await loadTimetable(filename, date, algorithm);

  if (!canShareMemory) {
    console.warn("SharedArrayBuffer is not available, so each worker will be given a copy of the timetable");
  }

  const workers = Math.min(
    Number(process.env.WORKERS) || os.cpus().length - 2,
    stops.length
  );

  console.log(`Planning ${stops.length} stops on ${workers} workers with ${algorithm}`);

  const started = performance.now();
  const bar = new ProgressBar("  [:current of :total] [:bar] :percent eta :eta  ", { total: stops.length });
  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "transfer-patterns-"));
  const parts = Array.from({ length: workers }, (_, id) => path.join(workDir, `worker-${id}.gz`));

  await Promise.all(parts.map(part => new Promise<void>((resolve, reject) => {
    const worker = new Worker(WORKER, {
      workerData: { ...timetable, date: date.toISOString(), output: part } satisfies WorkerInput
    });

    worker.on("message", (message: string) => {
      if (message === "done") {
        resolve();
        worker.terminate();

        return;
      }

      const stop = stops.pop();

      if (stop === undefined) {
        // let it close its file before it is taken away, or the last patterns are lost
        worker.postMessage(null);
      }
      else {
        bar.tick();
        worker.postMessage(stop);
      }
    });

    worker.on("error", reject);
  })));

  console.log(`\nPlanned in ${((performance.now() - started) / 1000).toFixed(1)}s`);
  console.log(`Merging into ${output}`);

  const { patterns, bytes } = await new TransferPatternMerge(workDir).merge(parts, output);

  await fs.promises.rm(workDir, { recursive: true, force: true });

  console.log(`${patterns.toLocaleString()} patterns, ${(bytes / 1024 / 1024).toFixed(1)}MB`);
}

/**
 * The timetable the workers are given, which is everything they need to plan
 */
async function loadTimetable(
  filename: string,
  date: Date,
  algorithm: Algorithm
): Promise<WorkerTimetable> {
  if (algorithm === "csa") {
    const shared = shareTimetable(await loadGtfs(fs.createReadStream(filename)), date);

    // every station is written as a fixed width code, so one of another width would run into the
    // station after it and the whole line would come back wrong
    checkCodeWidths(shared.stations);

    return { algorithm, timetable: shared };
  }

  const network = createNetwork(await loadGTFS(fs.createReadStream(filename)), date);

  checkCodeWidths(network.stopIds);

  return {
    algorithm,
    timetable: network.timetable,
    stopIds: network.stopIds,
    transfers: network.transfers,
    stations: network.stations
  };
}

/**
 * Reads stops.txt on its own rather than loading the whole feed, since the stop ids are all this
 * needs and the rest of a feed is expensive to build. stop_timezone is read directly because the
 * loader does not keep it.
 */
async function getStops(filename: string): Promise<StopID[]> {
  const stops = [] as StopID[];

  await readZip(toChunks(fs.createReadStream(filename)), entry => {
    if (entityTypeOf(entry.name) !== "stop") {
      return undefined;
    }

    // only the stations, and named the way the algorithm names them. A feed that identifies
    // platforms individually gives them the same timezone, so they are excluded by having a
    // parent rather than by their timezone
    const parser = new CSVParser(["stop_id", "stop_code", "stop_timezone", "parent_station"], row => {
      if (row.stop_timezone === "Europe/London" && row.parent_station === undefined) {
        stops.push(row.stop_code ?? row.stop_id as StopID);
      }
    });

    return (text, final) => {
      parser.write(text);

      if (final) {
        parser.end();
      }
    };
  });

  return stops;
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    algorithm: { type: "string", default: "raptor" }
  }
});

if (values.algorithm !== "raptor" && values.algorithm !== "csa") {
  console.log(`Unknown algorithm ${values.algorithm}, which should be raptor or csa.`);
  process.exit(1);
}
else if (positionals[0] && positionals[1]) {
  run(positionals[0], positionals[1], positionals[2] ?? "transfer-patterns.br", values.algorithm)
    .catch(e => { console.error(e); process.exit(1); });
}
else {
  console.log(
    "Please specify a GTFS file and date, and optionally where to write the patterns: a name " +
    "ending .br is brotli, and .gz the gzip a browser can read. --algorithm=csa scans for them " +
    "with the connection scan algorithm rather than raptor."
  );
}
