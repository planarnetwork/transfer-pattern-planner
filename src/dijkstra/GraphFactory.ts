import {
  AnyLeg,
  DateNumber,
  DayOfWeek,
  Duration,
  Interchange,
  StopID,
  Time,
  TimetableLeg,
  TimetableLegRepository,
  Transfer,
  TransferPatternRepository,
  TransferRepository
} from "..";
import { Graph } from "./DijkstraAlgorithm";

export class GraphFactory {
  constructor(
    private readonly patternRepository: TransferPatternRepository,
    private readonly timetableLegRepository: TimetableLegRepository,
    private readonly transferRepository: TransferRepository,
    private readonly interchange: Interchange
  ) {}

  /**
   * Create a transfer pattern for every origin. Each transfer pattern may arrive at a different destination.
   */
  public async getGraph(
    origins: StopID[],
    destinations: StopID[],
    date: DateNumber,
    dow: DayOfWeek
  ): Promise<Graph> {
    const patterns = await this.patternRepository.getPatterns(origins, destinations);
    const edges = {};

    for (const journey in patterns) {
      for (const patternStops of patterns[journey]) {
        if (this.doesNotContainGroupStops(patternStops, origins, destinations)) {
          const origin = journey.substring(0, 3);
          const destination = journey.substring(3);
          let currentStop = origin;

          patternStops.push(destination);

          for (const nextStop of patternStops) {
            const key = currentStop + nextStop;
            edges[key] = edges[key] || this.getEdge(currentStop, nextStop, date, dow);
          }
        }
      }
    }

    return Object.values(edges);
  }

  private doesNotContainGroupStops(pattern: StopID[], origins: StopID[], destinations: StopID[]): boolean {
    return origins.every(s => !pattern.includes(s)) && destinations.every(s => !pattern.includes(s));
  }

  private getEdge(origin: StopID, destination: StopID, date: DateNumber, dow: DayOfWeek): TransferPatternEdge {
    const timetableLegs = this.timetableLegRepository.getLegs(origin, destination, date, dow);
    const transfers = this.transferRepository.getTransfers(origin, destination);

    return new TransferPatternEdge(origin, destination, timetableLegs, transfers, this.interchange[destination]);
  }
}

export class TransferPatternEdge {
  private timetableLegIndex: number = 0;
  private transferIndex: number = 0;

  constructor(
    public readonly origin: StopID,
    public readonly destination: StopID,
    public readonly timetableLegs: TimetableLeg[],
    public readonly transfers: Transfer[],
    public readonly interchange: Duration
  ) {}

  public getLeg(departureTime: Time): AnyLeg | null {
    return this.findTimetableLeg(departureTime) || this.findTransfer(departureTime);
  }

  private findTimetableLeg(departureTime: Time): TimetableLeg | null {
    for (; this.timetableLegIndex < this.timetableLegs.length; this.timetableLegIndex++) {
      const leg = this.timetableLegs[this.timetableLegIndex];

      if (leg.stopTimes[0].departureTime >= departureTime) {
        return leg;
      }
    }

    return null;
  }

  public findTransfer(departureTime: Time): Transfer | null {
    for (; this.transferIndex < this.transfers.length; this.transferIndex++) {
      const leg = this.transfers[this.transferIndex];

      if (leg.startTime <= departureTime && leg.endTime >= departureTime) {
        return leg;
      }
    }

    return null;
  }
}
