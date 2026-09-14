import type { StopID, Time } from "@gb-transit/gtfs-loader";
import { isTransfer, originIndexOf } from "raptor-journey-planner";
import type { Connection, ConnectionIndex, Network, StopIdx } from "raptor-journey-planner";
import { PatternIndex } from "./PatternIndex.js";

/**
 * Collects the paths of each Raptor scan into the patterns they are written as.
 */
export class StringResults {
  private readonly patterns = new PatternIndex();
  /** Reused by every path, since a path is filed as soon as it has been walked */
  private readonly changePoints: StopID[] = [];

  /**
   * Extract the path from each kConnection result and store it in an index
   */
  public add(kConnections: ConnectionIndex, network: Network): number {
    let nextDepartureTime = Number.MAX_SAFE_INTEGER;

    for (let stop = 0; stop < kConnections.length; stop++) {
      const rounds = kConnections[stop];

      for (let k = 1; k < rounds.length; k++) {
        if (rounds[k] !== undefined) {
          const departureTime = this.record(kConnections, k, stop, network);

          if (departureTime !== undefined) {
            nextDepartureTime = Math.min(nextDepartureTime, departureTime + 1);
          }
        }
      }
    }

    return nextDepartureTime;
  }

  /**
   * The lines these patterns are written as, one per pattern
   */
  public lines(): string[] {
    return this.patterns.lines();
  }

  /**
   * Walk back through the connections to the stop the journey started at, file the stops it was
   * boarded at on the way, and return the time it left the first of them.
   *
   * Undefined where the connections lead nowhere, which is the only case the day's next departure
   * should not be taken from.
   */
  private record(
    kConnections: ConnectionIndex,
    k: number,
    finalDestination: StopIdx,
    network: Network
  ): Time | undefined {
    const changePoints = this.changePoints;

    let departureTime = Number.MAX_SAFE_INTEGER;
    let destination = finalDestination;
    let length = 0;

    for (let i = k; i > 0; i--) {
      const connection = kConnections[destination][i];

      if (connection === undefined) {
        break;
      }

      const transfer = isTransfer(connection) ? network.transfers[connection] : undefined;
      const origin = transfer
        ? (network.stopIndex.get(transfer.origin) as StopIdx)
        : originIndexOf(network, connection as Connection);

      // the interchange the scan added on arriving here, which the network holds already resolved
      // to a station and defaulted. The feed's own interchange is keyed by its stop ids, so it
      // cannot be looked up by the station a transfer names
      departureTime = transfer
        ? departureTime - transfer.duration - network.timetable.interchange[destination]
        : departureOf(network, connection as Connection);

      changePoints[length++] = network.stopIds[origin];
      destination = origin;
    }

    if (length === 0) {
      return undefined;
    }

    this.patterns.add(changePoints, length, network.stopIds[finalDestination]);

    return departureTime;
  }

}

/**
 * When the connection departs the stop it was boarded at.
 *
 * Read from the timetable rather than the feed's stop times, which hold the same departure but
 * only after the calls have been counted past the passing points. Taking it from the timetable is
 * what lets a pattern be built without the feed, so a worker can share a timetable rather than
 * load one of its own.
 */
function departureOf(network: Network, [route, trip, from]: Connection): Time {
  const { stopOffsets, stopTimesBase, tripOffsets, departures } = network.timetable.routes;
  const stopsInRoute = stopOffsets[route + 1] - stopOffsets[route];

  return departures[stopTimesBase[route] + (trip - tripOffsets[route]) * stopsInRoute + from];
}
