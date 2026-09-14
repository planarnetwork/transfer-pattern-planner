import type { StopID, Time } from "@gb-transit/gtfs-loader";
import {
  type ConnectionIndex, type GtfsData, isTransferConnection, NO_CONNECTION, type StopIdx, transferOf
} from "connection-scan-algorithm";
import { StringResults } from "./StringResults.js";

/**
 * Collects the labels of each connection scan into patterns. A label sooner than the one of a leg
 * fewer is a journey no other beats on both arrival and legs.
 */
export class ConnectionScanResults {
  private readonly patterns = new StringResults();
  private readonly changePoints: StopID[] = [];

  constructor(
    private readonly gtfs: GtfsData
  ) {}

  /**
   * File the pattern of every label, and return the time the next scan of the day should start from
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

  public lines(): string[] {
    return this.patterns.lines();
  }

  /**
   * Walk back through the labels as JourneyFactory does, file the stations each leg is boarded at, and
   * return when the journey departs, or undefined if it is only footpaths.
   */
  private record(index: ConnectionIndex, finalDestination: StopIdx, finalLabel: number): Time | undefined {
    const { connections, transfers, interchange, stopTable } = this.gtfs;
    const { levels, boardingTimes } = index;

    let station = finalDestination;
    let label = finalLabel;
    let departureTime: Time | undefined;
    let length = 0;

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

    this.patterns.file(this.changePoints, length, stopTable.nameOf(finalDestination));

    return departureTime;
  }

  /**
   * The label of the fewest legs the station can be boarded at by the time
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
