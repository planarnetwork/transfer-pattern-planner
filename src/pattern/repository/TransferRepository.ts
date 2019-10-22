import { StopID, Transfer, TransferIndex } from "../..";

export class TransferRepository {

  constructor(
    private readonly index: TransferIndex
  ) {}

  public getTransfers(origin: StopID, destination: StopID): Transfer[] {
    return (this.index[origin] && this.index[origin][destination]) || [];
  }
}