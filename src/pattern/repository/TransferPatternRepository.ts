import { StopID } from "../../gtfs/Gtfs";

export interface TransferPatternRepository {
  getPatterns(origins: StopID[], destinations: StopID[]): Promise<TransferPatternIndex>;
}

export type TransferPatternIndex = Record<string, string[][]>;