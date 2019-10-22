import { TransferIndex } from "../../gtfs/GtfsLoader";
import { StopID } from "../../gtfs/Gtfs";
import { Transfer } from "../../journey/Journey";

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
    return (this.index[origin] && this.index[origin][destination]) || [];
  }

}
