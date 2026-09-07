import type { StopID } from "@gb-transit/gtfs-loader";
import type { TransferIndex } from "../../gtfs/GtfsLoader.js";
import type { Transfer } from "../../journey/Journey.js";

/**
 * Provides access to transfers
 */
export class TransferRepository {

  constructor(
    private readonly index: TransferIndex
  ) {}

  /**
   * Return all transfers between the given origin and destination
   */
  public getTransfers(origin: StopID, destination: StopID): Transfer[] {
    return this.index[origin]?.[destination] ?? [];
  }

}
