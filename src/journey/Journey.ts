import { Duration, StopID, StopTime, Time, Trip } from "../gtfs/Gtfs";

/**
 * A leg
 */
export type AnyLeg = Transfer | TimetableLeg;

/**
 * A journey is a collection of legs
 */
export interface Journey {
  origin: StopID,
  destination: StopID,
  legs: AnyLeg[];
  departureTime: Time,
  arrivalTime: Time
}

/**
 * Leg of a journey
 */
export interface Leg {
  origin: StopID;
  destination: StopID;
}

/**
 * Leg with a defined departureTime and arrivalTime time
 */
export interface TimetableLeg extends Leg {
  stopTimes: StopTime[];
  trip: Trip;
}

/**
 * Leg with a duration instead of departureTime and arrivalTime time
 */
export interface Transfer extends Leg {
  duration: Duration;
  startTime: Time;
  endTime: Time;
}

/**
 * TypeScript guard to determine whether a leg is a Transfer
 */
export function isTransfer(leg: AnyLeg): leg is Transfer {
  return leg.hasOwnProperty("duration");
}
