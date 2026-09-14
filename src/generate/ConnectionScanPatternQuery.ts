import { getDateNumber, getDayOfWeek } from "@gb-transit/gtfs-loader";
import type { StopID, Time } from "@gb-transit/gtfs-loader";
import {
  type ConnectionIndex, firstArrivingAt, type GtfsData, type ScanResults, ScanResultsFactory, type StopIdx,
  UNKNOWN_STOP
} from "connection-scan-algorithm";
import { ConnectionScanResults } from "./ConnectionScanResults.js";
import type { PatternQuery } from "./PatternQuery.js";

/**
 * Uses the connection scan algorithm to perform full day range queries and collect the patterns they find.
 */
export class ConnectionScanPatternQuery implements PatternQuery {
  private readonly ONE_DAY = 24 * 60 * 60;

  private readonly scanResults: ScanResultsFactory;

  constructor(
    private readonly gtfs: GtfsData
  ) {
    this.scanResults = new ScanResultsFactory(gtfs);
  }

  /**
   * Scan a whole day from the origin and return the lines its patterns are written as
   */
  public plan(origin: StopID, dateObj: Date): string[] {
    const date = getDateNumber(dateObj);
    const running = this.gtfs.calendar.runningOn(date, getDayOfWeek(date));
    const results = new ConnectionScanResults(this.gtfs);

    // an origin the feed has no station for is not reachable, which is how the scan treats it too
    if (this.gtfs.stopTable.indexOf(origin) === UNKNOWN_STOP) {
      return results.lines();
    }

    let time = 1;

    while (time < this.ONE_DAY) {
      time = results.add(this.scan(origin, time, running));
    }

    return results.lines();
  }

  /**
   * ConnectionScanAlgorithm.scan, but reading to the end: it stops at once without destinations
   */
  private scan(origin: StopID, departureTime: Time, running: Uint8Array): ConnectionIndex {
    const { connections } = this.gtfs;
    const results = this.scanResults.create({ [origin]: departureTime }, []);

    for (const station of results.getOrigins()) {
      this.scanTransfers(results, station, 0);
    }

    for (let c = firstArrivingAt(connections, departureTime); c < connections.length; c++) {
      if (running[connections.trip[c]] && results.isReachable(c) && results.isBetter(c)) {
        const legs = results.setConnection(c);

        if (legs !== 0) {
          this.scanTransfers(results, connections.arrivalStation[c], legs);
        }
      }
    }

    return results.getConnectionIndex();
  }

  private scanTransfers(results: ScanResults, origin: StopIdx, legs: number): void {
    const { transfers } = this.gtfs;
    const start = transfers.offsets[origin];
    const end = transfers.offsets[origin + 1];

    for (let t = start; t < end; t++) {
      if (results.isTransferBetter(t, legs)) {
        results.setTransfer(t, legs);
      }
    }

    for (let t = start; t < end; t++) {
      if (results.isReachedByTransfer(t, legs)) {
        this.scanTransfers(results, transfers.destination[t], results.getLegsAfterWalking(legs));
      }
    }
  }

}
