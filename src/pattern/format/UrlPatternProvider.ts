import type { StopID } from "@gb-transit/gtfs-loader";
import { checkCodeWidths } from "./PatternFormat.js";
import type { PatternProvider } from "./PatternProvider.js";

export interface UrlPatternOptions {
  signal?: AbortSignal;
  headers?: HeadersInit;
  /** The fetch to use, for an environment that does not have one or for a test that fakes it */
  fetch?: typeof fetch;
  /** What a station's file is called, after the station. Defaults to `.br` */
  extension?: string;
}

/**
 * A station's patterns from a URL named for it, which is a plain GET a browser and a cache can each
 * make sense of without being told anything about the format.
 */
export class UrlPatternProvider implements PatternProvider {

  constructor(
    private readonly base: string | URL,
    private readonly options: UrlPatternOptions = {}
  ) {
    // without one the last segment is a filename rather than a directory, and is quietly replaced
    if (!String(base).endsWith("/")) {
      throw new Error(`The patterns are beneath ${base}, so it needs to end with a "/"`);
    }
  }

  public async get(station: StopID): Promise<Uint8Array | undefined> {
    // the station names the file, so a code that parsed as a URL of its own would fetch that host
    checkCodeWidths([station]);

    const get = this.options.fetch ?? fetch;
    const url = new URL(station + (this.options.extension ?? ".br"), this.base);
    const response = await get(String(url), { signal: this.options.signal, headers: this.options.headers });

    // a station the feed runs nothing from was never published, which is not a failed fetch
    if (response.status === 404) {
      return undefined;
    }

    if (!response.ok) {
      throw new Error(`Unable to fetch transfer patterns from ${url}: ${response.status} ${response.statusText}`);
    }

    return new Uint8Array(await response.arrayBuffer());
  }

}
