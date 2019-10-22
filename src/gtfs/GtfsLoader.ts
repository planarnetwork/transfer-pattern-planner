import * as gtfs from "gtfs-stream";
import { pushNested, setNested } from "ts-array-utils";
import { Readable } from "stream";
import { TimeParser } from "./TimeParser";
import { Service } from "./Service";
import { CalendarIndex, StopID, StopIndex, Time, Trip } from "./Gtfs";
import { Transfer } from "../journey/Journey";

/**
 * Returns trips, transfers, interchange time and calendars from a GTFS zip.
 */
export class GtfsLoader {

  constructor(
    private readonly timeParser: TimeParser
  ) {}

  public load(input: Readable): Promise<GtfsData> {
    return new Promise(resolve => {
      const processor = new StatefulGtfsLoader(this.timeParser);

      input
        .pipe(gtfs({ raw: true }))
        .on("data", entity => processor[entity.type] && processor[entity.type](entity.data))
        .on("end", () => resolve(processor.finalize()));
    });

  }

}

/**
 * Encapsulation of the GTFS data while it is being loaded from the zip
 */
class StatefulGtfsLoader {
  private readonly trips: Trip[] = [];
  private readonly transfers = {};
  private readonly interchange = {};
  private readonly calendars: CalendarIndex = {};
  private readonly dates = {};
  private readonly stopTimes = {};
  private readonly stops = {};

  constructor(
    private readonly timeParser: TimeParser
  ) {}

  public link(row: any): void {
    const t = {
      origin: row.from_stop_id,
      destination: row.to_stop_id,
      duration: +row.duration,
      startTime: this.timeParser.getTime(row.start_time),
      endTime: this.timeParser.getTime(row.end_time)
    };

    pushNested(t, this.transfers, row.from_stop_id);
  }

  public calendar(row: any): void {
    this.calendars[row.service_id] = {
      serviceId: row.service_id,
      startDate: +row.start_date,
      endDate: +row.end_date,
      days: {
        0: row.sunday === "1",
        1: row.monday === "1",
        2: row.tuesday === "1",
        3: row.wednesday === "1",
        4: row.thursday === "1",
        5: row.friday === "1",
        6: row.saturday === "1"
      },
      include: {},
      exclude: {}
    };
  }

  public calendar_date(row: any): void {
    setNested(row.exception_type === "1", this.dates, row.service_id, row.date);
  }

  public trip(row: any): void {
    this.trips.push({ serviceId: row.service_id, tripId: row.trip_id, stopTimes: [], service: {} as any });
  }

  public stop_time(row: any): void {
    const stopTime = {
      stop: row.stop_id,
      departureTime: this.timeParser.getTime(row.departure_time),
      arrivalTime: this.timeParser.getTime(row.arrival_time),
      pickUp: row.pickup_type === "0",
      dropOff: row.drop_off_type === "0"
    };

    pushNested(stopTime, this.stopTimes, row.trip_id);
  }

  public transfer(row: any): void {
    if (row.from_stop_id === row.to_stop_id) {
      this.interchange[row.from_stop_id] = +row.min_transfer_time;
    }
    else {
      const t = {
        origin: row.from_stop_id,
        destination: row.to_stop_id,
        duration: +row.min_transfer_time,
        startTime: 0,
        endTime: Number.MAX_SAFE_INTEGER
      };

      pushNested(t, this.transfers, row.from_stop_id, row.to_stop_id);
    }
  }

  public stop(row: any): void {
    const stop = {
      id: row.stop_id,
      code: row.stop_code,
      name: row.stop_name,
      description: row.stop_desc,
      latitude: +row.stop_lat,
      longitude: +row.stop_lon,
      timezone: row.zone_id
    };

    setNested(stop, this.stops, row.stop_id);
  }

  public finalize(): GtfsData {
    const services = {};
    const trips = {};

    for (const c of Object.values(this.calendars)) {
      services[c.serviceId] = new Service(c.startDate, c.endDate, c.days, this.dates[c.serviceId] || {});
    }

    for (const trip of this.trips) {
      trip.stopTimes = this.stopTimes[trip.tripId];
      trip.service = services[trip.serviceId];

      for (let i = 0; i < trip.stopTimes.length - 1; i++) {
        if (trip.stopTimes[i].pickUp) {
          for (let j = i + 1; j < trip.stopTimes.length; j++) {
            if (trip.stopTimes[j].dropOff) {
              pushNested(trip, trips, trip.stopTimes[i].stop, trip.stopTimes[j].stop);
            }
          }
        }
      }
    }

    return { trips, transfers: this.transfers, interchange: this.interchange, stops: this.stops };
  }

}

/**
 * Trips indexed by origin and destination
 */
export type TripIndex = Record<StopID, Record<StopID, Trip[]>>;
/**
 * Transfers indexed by origin and destination
 */
export type TransferIndex = Record<StopID, Record<StopID, Transfer[]>>;

/**
 * Index of stop to interchange time
 */
export type Interchange = Record<StopID, Time>;

/**
 * Contents of the GTFS zip file
 */
export type GtfsData = {
  trips: TripIndex,
  transfers: TransferIndex,
  interchange: Interchange,
  stops: StopIndex
};
