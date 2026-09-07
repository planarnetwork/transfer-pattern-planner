import type { StopID } from "@gb-transit/gtfs-loader";

export interface TransferPatternRepository {
  getPatterns(origins: StopID[], destinations: StopID[]): Promise<TransferPatternIndex>;
}

export type TransferPatternIndex = Record<string, string[][]>;