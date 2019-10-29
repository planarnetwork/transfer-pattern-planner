import { Journey } from "./journey/Journey";
import { Container } from "./Container";

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

  results.forEach(result => console.log(journeyToString(result)));

  await container.end();
}

function journeyToString(j: Journey) {
  return toTime(j.departureTime) + ", " +
    toTime(j.arrivalTime) + ", " +
    [j.legs[0].origin, ...j.legs.map(l => l.destination)].join("-");
}

function toTime(time: number) {
  let hours: any   = Math.floor(time / 3600);
  let minutes: any = Math.floor((time - (hours * 3600)) / 60);
  let seconds: any = time - (hours * 3600) - (minutes * 60);

  if (hours   < 10) { hours   = "0" + hours; }
  if (minutes < 10) { minutes = "0" + minutes; }
  if (seconds < 10) { seconds = "0" + seconds; }

  return hours + ":" + minutes + ":" + seconds;
}

main().catch(e => console.error(e));
