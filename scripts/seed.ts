// Builds the demo pool with the exact same pipeline the website uses.
//   npx tsx --env-file=.env.local scripts/seed.ts analyze [id...]  -> raw scrapes -> people + agent analysis
//   npx tsx --env-file=.env.local scripts/seed.ts date             -> every agent picks & goes on its dates
import { existsSync, readdirSync, readFileSync } from "fs";
import { ingest, sendOnDates } from "../src/lib/pipeline";
import { getPerson, listPeople, savePerson } from "../src/lib/store";
import type { Person } from "../src/lib/types";

const [cmd, ...ids] = process.argv.slice(2);

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<unknown>) {
  const q = [...items];
  await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()!); }));
}

(async () => {
  if (cmd === "analyze") {
    const files = readdirSync("data/raw").filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
    const todo = (ids.length ? ids : files).filter((id) => existsSync(`data/raw/${id}.json`) && getPerson(id)?.status !== "ready");
    console.log(`analyzing ${todo.length}`);
    await pool(todo, 3, async (id) => {
      const raw = JSON.parse(readFileSync(`data/raw/${id}.json`, "utf8"));
      const p: Person = {
        id, createdAt: Date.now(), linkedinUrl: raw.linkedinUrl, instagramUrl: raw.instagramUrl, status: "queued", datingStatus: "idle", log: [],
        linkedin: raw.linkedin, instagram: raw.instagram,
      };
      savePerson(p);
      await ingest(id);
      const done = getPerson(id)!;
      console.log(done.status === "ready" ? `OK   ${id}: ${done.analysis!.oneLiner}` : `FAIL ${id}: ${done.error}`);
    });
  } else if (cmd === "date") {
    const people = (ids.length ? ids.map((i) => getPerson(i)!) : listPeople()).filter((p) => p.status === "ready");
    console.log(`dating for ${people.length}`);
    await pool(people, Number(process.env.SEED_CONCURRENCY || 2), async (p) => {
      await sendOnDates(p.id);
      console.log(`DATED ${p.id}: ${getPerson(p.id)?.log.at(-1)?.step}`);
    });
  } else {
    console.log("usage: seed.ts analyze|date [ids...]");
  }
})();
