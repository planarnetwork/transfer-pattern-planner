import type { StopID, Time } from "@gb-transit/gtfs-loader";
import {
  type ConnectionIndex, type GtfsData, isTransferConnection, NO_CONNECTION, type StopIdx, transferOf
} from "connection-scan-algorithm";
import { PatternIndex } from "./PatternIndex.js";

/**
 * Collects the labels of each connection scan into the patterns they are written as.
 *
 * A station has a label for each number of legs it was reached soonest in. Each label that is sooner
 * than the one of fewer legs before it is a journey no other beats on both arrival and legs, and each
 * is a pattern: the stations its legs are boarded at, walked back through the labels as the
 * connection scan's JourneyFactory does.
 */
export class ConnectionScanResults {
  private readonly patterns = new PatternIndex();
  /** Reused by every path, since a path is filed as soon as it has been walked */
  private readonly changePoints: StopID[] = [];

  constructor(
    private readonly gtfs: GtfsData
  ) {}

  /**
   * File the pattern of every label the scan set, and return the time the next scan of the day should
   * start from
   */
  public add(index: ConnectionIndex): Time {
    const { levels, boardingTimes, connections } = index;
    const stations = connections.length / levels;

    let nextDepartureTime = Number.MAX_SAFE_INTEGER;

    for (let station = 0; station < stations; station++) {
      const row = station * levels;

      for (let label = row + 1; label < row + levels; label++) {
        if (connections[label] !== NO_CONNECTION && boardingTimes[label] < boardingTimes[label - 1]) {
          const departureTime = this.record(index, station, label);

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
   * Walk back through the labels from one of the station's, file the stations its legs are boarded at,
   * and return the time the journey left the first of them.
   *
   * Undefined where the path is only footpaths, which has no departure to take the day's next scan
   * from.
   */
  private record(index: ConnectionIndex, finalDestination: StopIdx, finalLabel: number): Time | undefined {
    const { connections, transfers, interchange, stopTable } = this.gtfs;
    const { levels, boardingTimes } = index;

    let station = finalDestination;
    let label = finalLabel;
    let departureTime: Time | undefined;
    let length = 0;

    // no journey has more legs than there are labels, so a timetable that loops cannot hang a worker
    while (index.connections[label] !== NO_CONNECTION && length < index.connections.length) {
      const connection = index.connections[label];

      if (isTransferConnection(connection)) {
        const t = transferOf(connection);
        const setOff = boardingTimes[label] - interchange[station] - transfers.duration[t];

        station = transfers.origin[t];
        label = this.labelInTime(index, station, setOff, 0);

        // walking from an origin is charged the interchange time its label does not have in it
        if (label % levels === 0 && boardingTimes[label] + interchange[station] > setOff) {
          label = this.labelInTime(index, station, setOff, 1);
        }

        // a footpath after the last trip does not move the departure, and one before the first is
        // left in time to reach it
        if (departureTime !== undefined) {
          departureTime -= transfers.duration[t] + interchange[station];
        }
      }
      else {
        station = connections.departureStation[connection];
        departureTime = connections.departureTime[connection];
        label = this.labelInTime(index, station, departureTime, 0);
      }

      this.changePoints[length++] = stopTable.nameOf(station);
    }

    this.patterns.add(this.changePoints, length, stopTable.nameOf(finalDestination));

    return departureTime;
  }

  /**
   * The label of the fewest legs, from those given, the station can be boarded at by the time
   */
  private labelInTime(index: ConnectionIndex, station: StopIdx, time: Time, fewestLegs: number): number {
    const end = (station + 1) * index.levels;

    let label = station * index.levels + fewestLegs;

    while (label < end - 1 && index.boardingTimes[label] > time) {
      label++;
    }

    return label;
  }

}
