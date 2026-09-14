import { parentPort, workerData } from "node:worker_threads";
import type { StopID, Transfer } from "@gb-transit/gtfs-loader";
import type { Network, Timetable } from "raptor-journey-planner";
import { ConnectionScanPatternQuery } from "../generate/ConnectionScanPatternQuery.js";
import type { PatternQuery } from "../generate/PatternQuery.js";
import { readSharedTimetable, type SharedTimetable } from "../generate/SharedTimetable.js";
import { StringResults } from "../generate/StringResults.js";
import { TransferPatternFile } from "../generate/TransferPatternFile.js";
import { TransferPatternQuery } from "../generate/TransferPatternQuery.js";

/**
 * Worker that finds transfer patterns for a given station.
 *
 * It is given the timetable rather than a feed to build one from. The timetable is allocated on
 * SharedArrayBuffers, so every worker reads the one the main thread built instead of loading the
 * feed again, and building a pattern needs nothing else from it: naming a path takes the stop ids
 * and the transfers, both of which are small enough to copy.
 *
 * Its patterns go straight to a file of its own, which the run merges once every station is done.
 * Folding them into a tree needs all of them in order, so a worker cannot do that part alone.
 */
export type Algorithm = WorkerTimetable["algorithm"];

export type WorkerTimetable = {
  algorithm: "raptor";
  timetable: Timetable;
  stopIds: StopID[];
  transfers: Transfer[];
  stations: Map<StopID, StopID>;
} | {
  algorithm: "csa";
  timetable: SharedTimetable;
};

export type WorkerInput = WorkerTimetable & {
  date: string;
  output: string;
};

function worker(input: WorkerInput): void {
  const query = createQuery(input);
  const planFor = new Date(input.date);
  const patterns = new TransferPatternFile(input.output);

  parentPort?.on("message", async (stop: StopID | null) => {
    // nothing left to plan, so finish the file before the run takes this thread away
    if (stop === null) {
      await patterns.close();
      parentPort?.postMessage("done");

      return;
    }

    await patterns.store(query.plan(stop, planFor));
    parentPort?.postMessage("ready");
  });

  parentPort?.postMessage("ready");
}

function createQuery(input: WorkerTimetable): PatternQuery {
  if (input.algorithm === "csa") {
    return new ConnectionScanPatternQuery(readSharedTimetable(input.timetable));
  }

  const { timetable, stopIds, stations, transfers } = input;
  const network: Network = {
    timetable,
    stopIds,
    stopIndex: new Map(stopIds.map((stop, index) => [stop, index])),
    stations,
    transfers,
    // the feed's trips are the hundreds of megabytes this worker exists to do without. They name
    // the stop times of a journey, and a transfer pattern does not carry those: the only thing
    // that reached for them was the departure a path is dated by, which is in the timetable too
    trips: []
  };

  return new TransferPatternQuery(network, () => new StringResults());
}

if (workerData) {
  worker(workerData as WorkerInput);
}
