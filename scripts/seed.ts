// Builds the demo pool with the exact same pipeline the website uses.
//   npx tsx --env-file=.env.local scripts/seed.ts analyze [id...]  -> raw scrapes -> people + agent analysis
//   npx tsx --env-file=.env.local scripts/seed.ts date             -> every agent picks & goes on its dates
import { existsSync, readdirSync, readFileSync } from "fs";
import { runDate } from "../src/lib/agents/date";
import { ensureGender, ingest, sendOnDates } from "../src/lib/pipeline";
import { getPerson, listDates, listPeople, savePerson, updatePerson } from "../src/lib/store";
import type { Person } from "../src/lib/types";

const [cmd, ...argIds] = process.argv.slice(2);
const ids = argIds.length === 1 && argIds[0].startsWith("@") ? readFileSync(argIds[0].slice(1), "utf8").split(/\s+/).filter(Boolean) : argIds;

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<unknown>) {
  const q = [...items];
  await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()!); }));
}

(async () => {
  if (cmd === "analyze") {
    const files = readdirSync("data/raw").filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
    const todo: string[] = [];
    for (const id of ids.length ? ids : files) if (existsSync(`data/raw/${id}.json`) && (await getPerson(id))?.status !== "ready") todo.push(id);
    console.log(`analyzing ${todo.length}`);
    await pool(todo, 3, async (id) => {
      const raw = JSON.parse(readFileSync(`data/raw/${id}.json`, "utf8"));
      const p: Person = {
        id, createdAt: Date.now(), linkedinUrl: raw.linkedinUrl, instagramUrl: raw.instagramUrl, status: "queued", datingStatus: "idle", log: [],
        linkedin: raw.linkedin, instagram: raw.instagram,
      };
      await savePerson(p);
      await ingest(id);
      const done = (await getPerson(id))!;
      console.log(done.status === "ready" ? `OK   ${id}: ${done.analysis!.oneLiner}` : `FAIL ${id}: ${done.error}`);
    });
  } else if (cmd === "gender") {
    const people = (await listPeople()).filter((p) => p.status === "ready" && !p.gender);
    await pool(people, 3, async (p) => {
      await ensureGender(p.id);
      const x = (await getPerson(p.id))!;
      console.log(`${p.id}: ${x.gender} -> ${x.seeking} (${x.genderEvidence})`);
    });
  } else if (cmd === "redo") {
    // Re-run dates that failed (same pair + scene), then finish agents whose dating never completed.
    const failed = (await listDates()).filter((d) => d.status !== "done");
    console.log(`redoing ${failed.length} dates`);
    await pool(failed, Number(process.env.SEED_CONCURRENCY || 2), async (d) => {
      const r = await runDate({ ...d, status: "planning", messages: [], debriefs: {}, error: undefined, venue: d.scene ? undefined : d.venue });
      console.log(`${r.status === "done" ? "DONE" : "FAIL"} ${d.id} ${r.error ?? ""}`);
    });
    for (const p of (await listPeople()).filter((x) => x.status === "ready" && x.datingStatus !== "done")) {
      if (p.shortlist?.length) await updatePerson(p.id, (x) => (x.datingStatus = "done"));
      else {
        await sendOnDates(p.id);
        console.log(`DATED ${p.id}: ${(await getPerson(p.id))?.log.at(-1)?.step}`);
      }
    }
  } else if (cmd === "date") {
    const people = (ids.length ? ((await Promise.all(ids.map((i) => getPerson(i)))) as Person[]) : await listPeople()).filter((p) => p?.status === "ready");
    console.log(`dating for ${people.length}`);
    await pool(people, Number(process.env.SEED_CONCURRENCY || 2), async (p) => {
      await sendOnDates(p.id);
      console.log(`DATED ${p.id}: ${(await getPerson(p.id))?.log.at(-1)?.step}`);
    });
  } else {
    console.log("usage: seed.ts analyze|date [ids...]");
  }
})();
