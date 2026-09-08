import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DirectoryPatternProvider } from "../../../../src/pattern/format/DirectoryPatternProvider.js";
import { UrlPatternProvider } from "../../../../src/pattern/format/UrlPatternProvider.js";

const made: string[] = [];

function directory(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "patterns-test-"));

  made.push(dir);

  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), body);
  }

  return dir;
}

afterEach(() => {
  for (const dir of made.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("DirectoryPatternProvider", () => {

  it("reads the file named for the station", async () => {
    const dir = directory({ "LST.br": "the patterns" });

    expect(Buffer.from(await new DirectoryPatternProvider(dir).get("LST") as Uint8Array).toString())
      .toBe("the patterns");
  });

  it("gives nothing for a station with no file, which is not a failure to read one", async () => {
    expect(await new DirectoryPatternProvider(directory({})).get("ZZZ")).toBe(undefined);
  });

  it("gives nothing when the directory is not there at all", async () => {
    expect(await new DirectoryPatternProvider("/no/such/place").get("LST")).toBe(undefined);
  });

});

describe("UrlPatternProvider", () => {

  it("fetches the station beneath the base", async () => {
    const asked: string[] = [];
    const provider = new UrlPatternProvider("https://example.com/patterns/", {
      fetch: async (url) => { asked.push(String(url)); return new Response("the patterns"); }
    });

    expect(Buffer.from(await provider.get("LST") as Uint8Array).toString()).toBe("the patterns");
    expect(asked).toEqual(["https://example.com/patterns/LST.br"]);
  });

  it("gives nothing for a station that was never published", async () => {
    const provider = new UrlPatternProvider("https://example.com/patterns/", {
      fetch: async () => new Response("", { status: 404 })
    });

    expect(await provider.get("ZZZ")).toBe(undefined);
  });

  it("says which station it could not fetch", async () => {
    const provider = new UrlPatternProvider("https://example.com/patterns/", {
      fetch: async () => new Response("", { status: 500, statusText: "Server Error" })
    });

    await expect(provider.get("LST")).rejects.toThrow(/patterns\/LST.br: 500 Server Error/);
  });

  it("takes the extension the files were written with", async () => {
    const asked: string[] = [];
    const provider = new UrlPatternProvider("https://example.com/p/", {
      extension: ".gz",
      fetch: async (url) => { asked.push(String(url)); return new Response(""); }
    });

    await provider.get("LST");

    expect(asked).toEqual(["https://example.com/p/LST.gz"]);
  });

});

describe("what a provider will take for a station", () => {

  it("refuses a directory station that would climb out of it", async () => {
    await expect(new DirectoryPatternProvider("/data/stations").get("../../etc/passwd"))
      .rejects.toThrow(/3 character station codes/);
  });

  it("refuses a fetched station that would name another host", async () => {
    const provider = new UrlPatternProvider("https://example.com/patterns/", {
      fetch: async () => new Response("")
    });

    await expect(provider.get("https://evil.example/x")).rejects.toThrow(/3 character station codes/);
  });

  it("refuses a base that would drop its last segment", () => {
    expect(() => new UrlPatternProvider("https://example.com/patterns"))
      .toThrow(/needs to end with a "\/"/);
  });

});
