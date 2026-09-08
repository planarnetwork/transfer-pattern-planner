import { CODE_WIDTH, NONE_SHARED } from "./PatternFormat.js";

/**
 * Writes sorted lines as the tree they describe, each saying what it adds to the one before it.
 *
 * Every line is one pattern, so nothing marks a pattern a longer one runs through. The lines have
 * to arrive in order, and one coder covers one run of them.
 */
export class FrontCoder {

  private previous = "";

  public code(line: string): string {
    const shared = this.sharedWith(line);

    this.previous = line;

    return String.fromCharCode(NONE_SHARED + shared) + line.slice(shared * CODE_WIDTH);
  }

  /** Half a station is not a shared station, so characters in common round down to the last code */
  private sharedWith(line: string): number {
    const limit = Math.min(line.length, this.previous.length);

    let same = 0;

    while (same < limit && line[same] === this.previous[same]) {
      same++;
    }

    return Math.floor(same / CODE_WIDTH);
  }

}
