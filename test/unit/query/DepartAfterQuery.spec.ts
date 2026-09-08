import type { DateNumber, DayOfWeek, ServiceCalendar } from "@gb-transit/gtfs-loader";
import { describe, expect, it } from "vitest";
import type { GtfsData } from "../../../src/gtfs/GtfsLoader.js";
import { DepartAfterQuery } from "../../../src/query/DepartAfterQuery.js";
import { between, calls, st, stopsFor } from "../util.js";

describe("DepartAfterQuery", () => {

  it("asks the calendar for the local date when the UTC date is a day behind", () => {
    const days: ServiceDay[] = [];
    const query = queryRecording(days);

    // 00:30 on Tuesday 8 September in London is still Monday 7 September in UTC
    inTimezone("Europe/London", () => query.plan(["A"], ["B"], new Date("2026-09-08T00:30:00+01:00"), 1000));

    expect(days).toEqual([{ date: 20260908, dow: 2 }]);
  });

  it("asks the calendar for the local date when the UTC date is a day ahead", () => {
    const days: ServiceDay[] = [];
    const query = queryRecording(days);

    // 20:00 on Tuesday 8 September in New York is already Wednesday 9 September in UTC
    inTimezone("America/New_York", () => query.plan(["A"], ["B"], new Date("2026-09-08T20:00:00-04:00"), 1000));

    expect(days).toEqual([{ date: 20260908, dow: 2 }]);
  });

  it("pads single digit months and days", () => {
    const days: ServiceDay[] = [];
    const query = queryRecording(days);

    inTimezone("Europe/London", () => query.plan(["A"], ["B"], new Date("2026-01-05T12:00:00Z"), 1000));

    expect(days).toEqual([{ date: 20260105, dow: 1 }]);
  });

});

interface ServiceDay {
  date: DateNumber,
  dow: DayOfWeek
}

/**
 * A query over a single trip from A to B, whose calendar records the day it is asked about.
 */
function queryRecording(days: ServiceDay[]): DepartAfterQuery {
  const stops = stopsFor("A", "B");
  const aToB = calls(stops, st("A", 1000), st("B", 1100));

  const gtfs: GtfsData = {
    trips: between(stops, [["A", "B", [{ ...aToB, trip: { ...aToB.trip, service: recordingCalendar(days) } }]]]),
    transfers: [],
    interchange: [],
    stops,
    feedStops: {},
    stations: new Map()
  };

  return new DepartAfterQuery(gtfs, { getPatterns: () => [[]] });
}

/**
 * A calendar that says yes to every day, and remembers which it was asked about.
 */
function recordingCalendar(days: ServiceDay[]): ServiceCalendar {
  const calendar: ServiceCalendar = {
    runsOn: (date, dow) => {
      days.push({ date, dow });

      return true;
    },
    dayEarlier: () => calendar
  };

  return calendar;
}

/**
 * Run with the machine clock in the given zone so that the local and UTC dates differ predictably,
 * whatever zone the machine running the test is in.
 */
function inTimezone(timezone: string, fn: () => void): void {
  const original = process.env.TZ;
  process.env.TZ = timezone;

  try {
    fn();
  }
  finally {
    if (original === undefined) {
      delete process.env.TZ;
    }
    else {
      process.env.TZ = original;
    }
  }
}
