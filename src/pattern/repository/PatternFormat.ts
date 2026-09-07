import type { StopID } from "@gb-transit/gtfs-loader";

/**
 * Reading the transfer pattern file raptor's `npm run patterns` writes.
 *
 * The format is raptor's, and this is the reading half of its `PatternFormat`. It is repeated here
 * rather than imported so that consuming a file does not mean depending on the journey planner that
 * produced it; the tests pin the exact lines, so a change to the format shows up as a failure here
 * rather than as journeys planned through the wrong stations.
 */

/**
 * A transfer pattern as the stations it calls at, from the first to the last.
 */
export type PatternPath = StopID[];

/**
 * Characters in a station code. Every code in a file is this wide, which is what lets a line be
 * read back by cutting it up rather than looking for separators.
 */
export const CODE_WIDTH = 3;

/**
 * The character a shared count of nothing is written as. Counting up from it rather than writing a
 * digit means a pattern of more than ten stations carries on into the characters above `9` instead
 * of overflowing, and a national feed holds patterns of fourteen.
 */
const NONE_SHARED = "0".charCodeAt(0);

/**
 * Read the stations of each pattern.
 *
 * Sorting puts patterns sharing a leading run of stations next to each other, so a line only says
 * how many of them it takes from the line before and what follows. That is a tree written depth
 * first, and it needs no marker for a pattern another pattern runs through, since every line is one
 * pattern.
 *
 * It takes the lines a few at a time rather than all at once, since a national feed holds tens of
 * millions of them, which is why it will take a stream as readily as an array.
 */
export async function* readPatterns(
  lines: AsyncIterable<string> | Iterable<string>
): AsyncGenerator<PatternPath> {
  let previous: PatternPath = [];

  for await (const line of lines) {
    if (line === "") {
      continue;
    }

    const shared = line.charCodeAt(0) - NONE_SHARED;
    const path = previous.slice(0, shared);

    for (let at = 1; at < line.length; at += CODE_WIDTH) {
      path.push(line.slice(at, at + CODE_WIDTH));
    }

    yield path;
    previous = path;
  }
}
