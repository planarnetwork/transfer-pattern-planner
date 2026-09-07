import { Container } from "../Container.js";
import type { Journey } from "../journey/Journey.js";

async function main() {
  const container = new Container();
  const query = await container.getQuery();

  console.time("query");
  const results = await query.plan(
    ["BHM", "BMO", "BSW", "BHI"],
    [
      "EUS", "MYB", "STP", "PAD", "BFR", "CTK", "CST", "CHX", "LBG",
      "WAE", "VIC", "VXH", "WAT", "OLD", "MOG", "KGX", "LST", "FST"
    ],
    new Date(),
    3600 * 4 + 1800
  );
  console.timeEnd("query");

  for (const result of results) {
    console.log(journeyToString(result));
  }

  await container.end();
}

function journeyToString(j: Journey) {
  return `${toTime(j.departureTime)}, ${toTime(j.arrivalTime)}, ${
    [j.legs[0].origin, ...j.legs.map(l => l.destination)].join("-")}`;
}

function toTime(time: number) {
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time - (hours * 3600)) / 60);
  const seconds = time - (hours * 3600) - (minutes * 60);

  return [hours, minutes, seconds].map(v => v.toString().padStart(2, "0")).join(":");
}

main().catch(e => console.error(e));
