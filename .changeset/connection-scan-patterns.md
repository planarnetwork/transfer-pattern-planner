---
"transfer-pattern-planner": minor
---

Generate transfer patterns with the connection scan algorithm as well as raptor.
`npm run patterns gtfs.zip 2026-09-15 transfer-patterns.br --algorithm=csa` scans with
connection-scan-algorithm 3.1.0, and `ConnectionScanPatternQuery` is exported from
`transfer-pattern-planner/generate` beside `TransferPatternQuery`, which both implement `PatternQuery`.
`shareTimetable` and `readSharedTimetable` put a connection scan timetable for one date on
SharedArrayBuffers for workers, and `StringResults.file` is public.

Over the GB rail feed the two algorithms' patterns give the same journeys for 4,827 of 5,000 random
queries, and the connection scan plans a day in 18s against raptor's 26s.

The merge writes a bucket at a time rather than a line at a time, so a day's run takes about a minute
rather than four, and brotli is given a size hint, which makes the file a fifth smaller.

Two journeys are no longer lost, whichever algorithm made the patterns:
- a pattern walks where that arrives before the next timetable leg, rather than taking the last train
  of the day between two stations a footpath also joins
- a trip that calls at a station twice is boarded at the last call before the destination, rather
  than the first, which had the passenger ride the whole loop

Requires @gb-transit/gtfs-loader 1.5.
