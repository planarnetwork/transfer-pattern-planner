import { CODE_WIDTH, type PatternPath, sharedStops } from "./PatternFormat.js";

/**
 * Reads back what FrontCoder wrote, as the stations of each pattern. A national feed holds tens of
 * millions of lines, so they are taken a few at a time and a stream will do as well as an array.
 */
export class PatternReader {

  public async *read(lines: AsyncIterable<string> | Iterable<string>): AsyncGenerator<PatternPath> {
    let previous: PatternPath = [];

    for await (const line of lines) {
      if (line === "") {
        continue;
      }

      const path = previous.slice(0, sharedStops(line));

      for (let at = 1; at < line.length; at += CODE_WIDTH) {
        path.push(line.slice(at, at + CODE_WIDTH));
      }

      yield path;
      previous = path;
    }
  }

}
