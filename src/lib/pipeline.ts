import { analyzePerson } from "./agents/analyze";
import { chooseDates, runDate } from "./agents/date";
import { compatible, defaultSeeking, inferGender } from "./agents/gender";
import { parseInstagramUsername, parseLinkedInSlug, scrapeInstagram, scrapeLinkedIn, ScrapeError } from "./scrape";
import { datesFor, getDate, getPerson, listDates, listPeople, logStep, pairId, savePerson, updatePerson } from "./store";
import type { DateRecord, Gender, Person, RankingRow, Scene, Seeking } from "./types";

// In-process job registry (survives dev hot reloads) so the same job never runs twice concurrently.
const g = globalThis as unknown as { __jobs?: Map<string, Promise<unknown>> };
const jobs = (g.__jobs ??= new Map());
function job<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (jobs.has(key)) return jobs.get(key) as Promise<T>;
  const p = fn().finally(() => jobs.delete(key));
  jobs.set(key, p);
  return p;
}
export const isRunning = (key: string) => jobs.has(key);

// ---------- Ingest: scrape both sources, then the agent reads & analyzes ----------

export function createPerson(linkedinUrl: string, instagramUrl: string, gender?: Gender, seeking?: Seeking): Person {
  parseLinkedInSlug(linkedinUrl); // validate early, throws ScrapeError with a friendly message
  const id = parseInstagramUsername(instagramUrl);
  const existing = getPerson(id);
  if (existing && existing.status !== "error") {
    // Re-submitting an existing person can update their stated preferences.
    if (gender && gender !== "unknown") return updatePerson(id, (x) => ((x.gender = gender), (x.seeking = seeking ?? defaultSeeking(gender)), (x.genderSource = "stated")));
    return existing;
  }
  const stated = gender && gender !== "unknown";
  const p: Person = {
    id, createdAt: Date.now(), linkedinUrl, instagramUrl, status: "queued", datingStatus: "idle", log: [],
    ...(stated ? { gender, seeking: seeking ?? defaultSeeking(gender), genderSource: "stated" as const } : {}),
  };
  savePerson(p);
  return p;
}

export function ingest(id: string) {
  return job(`ingest:${id}`, async () => {
    const p = getPerson(id)!;
    try {
      updatePerson(id, (x) => ((x.status = "scraping"), (x.error = undefined)));
      logStep(id, "Opening Instagram", p.instagramUrl);
      const instagram = p.instagram ?? (await scrapeInstagram(p.instagramUrl));
      updatePerson(id, (x) => ((x.instagram = instagram), (x.photo = instagram.profilePic)));
      logStep(id, `Read Instagram @${instagram.username}`, `${instagram.posts.length} recent posts, bio: “${(instagram.bio ?? "").slice(0, 80)}” · via ${instagram.method}`);

      logStep(id, "Opening LinkedIn", p.linkedinUrl);
      const linkedin = p.linkedin ?? (await scrapeLinkedIn(p.linkedinUrl));
      updatePerson(id, (x) => ((x.linkedin = linkedin), (x.photo ||= linkedin.profilePic)));
      logStep(id, `Read LinkedIn: ${linkedin.name ?? linkedin.slug}`, `${linkedin.headline ?? ""} · ${linkedin.posts.length} posts/articles · via ${linkedin.method}`);

      // Sanity check that both links belong to the same human.
      const first = (n?: string) => (n ?? "").toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").trim().split(/\s+/)[0];
      if (/\*{3}/.test(linkedin.headline ?? "")) logStep(id, "⚠ Identity check", "LinkedIn profile is restricted/masked — double-check it's the right person");
      else if (first(linkedin.name) && first(instagram.fullName) && first(linkedin.name) !== first(instagram.fullName))
        logStep(id, "⚠ Identity check", `LinkedIn says “${linkedin.name}”, Instagram says “${instagram.fullName}” — analysing anyway`);
      else logStep(id, "✓ Identity check", "LinkedIn and Instagram names match");

      updatePerson(id, (x) => (x.status = "analyzing"));
      logStep(id, "Agent is reading both profiles", "cross-referencing career, captions and photos");
      const [analysis] = await Promise.all([analyzePerson(linkedin, instagram), ensureGender(id)]);
      updatePerson(id, (x) => {
        x.analysis = analysis;
        x.status = "ready";
      });
      logStep(id, "Profile analysis complete", analysis.oneLiner);
    } catch (e) {
      const msg = e instanceof ScrapeError ? e.message : `Something went wrong: ${(e as Error).message}`;
      updatePerson(id, (x) => ((x.status = "error"), (x.error = msg)));
      logStep(id, "Failed", msg);
    }
  });
}

/** If the person didn't state their gender on the form, the agent infers it from the two sources. */
export async function ensureGender(id: string) {
  const p = getPerson(id)!;
  if (p.gender && p.seeking) return;
  if (!p.linkedin || !p.instagram) return;
  const { gender, evidence } = await inferGender(p.linkedin, p.instagram);
  updatePerson(id, (x) => ((x.gender = gender), (x.seeking = defaultSeeking(gender)), (x.genderSource = "inferred"), (x.genderEvidence = evidence)));
  logStep(id, `Identified as ${gender === "unknown" ? "gender unknown" : `a ${gender}`}, looking for ${defaultSeeking(gender)}`, evidence);
}

// ---------- Dating: the agent picks who to ask out, then goes on the dates ----------

const DATES_PER_PERSON = Number(process.env.DATES_PER_PERSON || 3);

export function sendOnDates(id: string, k = DATES_PER_PERSON, scene?: Scene) {
  return job(`dating:${id}`, async () => {
    try {
      const me = getPerson(id)!;
      const pool = listPeople().filter((p) => p.status === "ready" && (p.id === id || compatible(me, p)));
      updatePerson(id, (x) => (x.datingStatus = "choosing"));
      logStep(id, "Agent is reviewing the pool", `${pool.length - 1} other agents' clients`);
      const { shortlist, invite } = await chooseDates(me, pool, k);
      updatePerson(id, (x) => ((x.shortlist = shortlist), (x.datingStatus = "dating")));
      logStep(id, "Asked out", invite.map((i) => getPerson(i.id)?.analysis?.name ?? i.id).join(", "));

      await Promise.all(
        invite.map(async (inv) => {
          const key = pairId(id, inv.id);
          // One date per pair: if the other agent already asked us out (or is doing so right now), reuse it.
          return job(`date:${key}`, async () => {
            const existing = getDate(key);
            if (existing && existing.status === "done") return existing;
            const rec: DateRecord = { id: key, a: id, b: inv.id, scene, createdAt: Date.now(), status: "planning", messages: [], debriefs: {} };
            return runDate(rec);
          });
        })
      );
      updatePerson(id, (x) => (x.datingStatus = "done"));
      logStep(id, "All dates finished", "rankings updated");
    } catch (e) {
      updatePerson(id, (x) => (x.datingStatus = "error"));
      logStep(id, "Dating failed", (e as Error).message);
    }
  });
}

// ---------- Ranking ----------

/**
 * For every person, rank everyone else. Real dates dominate: score = mean of BOTH agents' "overall"
 * (+5 if both want a second date). Candidates without a date fall back to the pre-date interest
 * (from either agent's shortlist), scaled down so actual dates rank first when they went well.
 */
export function rankingsFor(id: string): RankingRow[] {
  const me = getPerson(id);
  const people = listPeople().filter((p) => p.status === "ready" && p.id !== id && (!me || compatible(me, p)));
  const dates = new Map(datesFor(id).filter((d) => d.status === "done").map((d) => [d.a === id ? d.b : d.a, d]));
  return people
    .map((o): RankingRow => {
      const base = { id: o.id, name: o.analysis!.name, photo: o.photo, oneLiner: o.analysis!.oneLiner };
      const d = dates.get(o.id);
      if (d) {
        const mine = d.debriefs[id];
        const theirs = d.debriefs[o.id];
        const mutual = !!(mine?.secondDate && theirs?.secondDate);
        const score = Math.min(100, Math.round(((mine?.overall ?? 0) + (theirs?.overall ?? 0)) / 2 + (mutual ? 5 : 0)));
        return { ...base, score, basis: "mutual-date", myScore: mine?.overall, theirScore: theirs?.overall, mutualSecondDate: mutual, dateId: d.id, reason: mine?.highlight || mine?.reportToHuman || "" };
      }
      const myPick = me?.shortlist?.find((s) => s.id === o.id);
      const theirPick = o.shortlist?.find((s) => s.id === id);
      const vals = [myPick?.interest, theirPick?.interest].filter((v): v is number => typeof v === "number");
      const score = vals.length ? Math.round((vals.reduce((x, y) => x + y, 0) / vals.length) * 0.85) : 0;
      return { ...base, score, basis: "pre-date", myScore: myPick?.interest, theirScore: theirPick?.interest, reason: myPick?.reason || theirPick?.reason || "Not yet assessed" };
    })
    .sort((x, y) => y.score - x.score);
}

export function overview() {
  const people = listPeople();
  const dates = listDates();
  return { people, dates };
}
