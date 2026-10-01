import { analyzePerson } from "./agents/analyze";
import { chooseDates, runDate, stepDate } from "./agents/date";
import { compatible, defaultSeeking, inferGender } from "./agents/gender";
import { parseInstagramUsername, parseLinkedInSlug, scrapeInstagram, scrapeLinkedIn, ScrapeError } from "./scrape";
import { getDate, getPerson, listDates, listPeople, logStep, pairId, saveDate, savePerson, tryLock, unlock, updatePerson } from "./store";
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

/** Turn internal failures (quota, timeouts) into something a visitor can understand. */
export function friendlyError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (e instanceof ScrapeError) return m;
  if (/429|quota|rate limit|No LLM|no LLM target/i.test(m))
    return "Our AI agents are out of free capacity right now (LLM rate limit). Please try again in a few minutes.";
  if (/timeout|aborted/i.test(m)) return "That took too long — please try again.";
  return "Something went wrong while the agent was working. Please try again.";
}

// ---------- Ingest: scrape both sources, then the agent reads & analyzes ----------

export async function createPerson(linkedinUrl: string, instagramUrl: string, gender?: Gender, seeking?: Seeking): Promise<Person> {
  parseLinkedInSlug(linkedinUrl); // validate early, throws ScrapeError with a friendly message
  const id = parseInstagramUsername(instagramUrl);
  const existing = await getPerson(id);
  if (existing && existing.status !== "error") {
    // Re-submitting an existing person can update their stated preferences.
    if (gender && gender !== "unknown") return await updatePerson(id, (x) => ((x.gender = gender), (x.seeking = seeking ?? defaultSeeking(gender)), (x.genderSource = "stated")));
    return existing;
  }
  const stated = gender && gender !== "unknown";
  const p: Person = {
    id, createdAt: Date.now(), linkedinUrl, instagramUrl, status: "queued", datingStatus: "idle", log: [],
    ...(stated ? { gender, seeking: seeking ?? defaultSeeking(gender), genderSource: "stated" as const } : {}),
  };
  await savePerson(p);
  return p;
}

export function ingest(id: string) {
  return job(`ingest:${id}`, async () => {
    const p = (await getPerson(id))!;
    try {
      await updatePerson(id, (x) => ((x.status = "scraping"), (x.error = undefined)));
      await logStep(id, "Opening Instagram", p.instagramUrl);
      const instagram = p.instagram ?? (await scrapeInstagram(p.instagramUrl));
      await updatePerson(id, (x) => ((x.instagram = instagram), (x.photo = instagram.profilePic)));
      await logStep(id, `Read Instagram @${instagram.username}`, `${instagram.posts.length} recent posts, bio: “${(instagram.bio ?? "").slice(0, 80)}” · via ${instagram.method}`);

      await logStep(id, "Opening LinkedIn", p.linkedinUrl);
      const linkedin = p.linkedin ?? (await scrapeLinkedIn(p.linkedinUrl));
      await updatePerson(id, (x) => ((x.linkedin = linkedin), (x.photo ||= linkedin.profilePic)));
      await logStep(id, `Read LinkedIn: ${linkedin.name ?? linkedin.slug}`, `${linkedin.headline ?? ""} · ${linkedin.posts.length} posts/articles · via ${linkedin.method}`);

      // Sanity check that both links belong to the same human.
      const first = (n?: string) => (n ?? "").toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").trim().split(/\s+/)[0];
      if (/\*{3}/.test(linkedin.headline ?? "")) await logStep(id, "⚠ Identity check", "LinkedIn profile is restricted/masked — double-check it's the right person");
      else if (first(linkedin.name) && first(instagram.fullName) && first(linkedin.name) !== first(instagram.fullName))
        await logStep(id, "⚠ Identity check", `LinkedIn says “${linkedin.name}”, Instagram says “${instagram.fullName}” — analysing anyway`);
      else await logStep(id, "✓ Identity check", "LinkedIn and Instagram names match");

      await updatePerson(id, (x) => (x.status = "analyzing"));
      await logStep(id, "Agent is reading both profiles", "cross-referencing career, captions and photos");
      const [analysis] = await Promise.all([analyzePerson(linkedin, instagram), ensureGender(id)]);
      await updatePerson(id, (x) => {
        x.analysis = analysis;
        x.status = "ready";
      });
      await logStep(id, "Profile analysis complete", analysis.oneLiner);
    } catch (e) {
      const msg = friendlyError(e);
      console.error(`[ingest ${id}]`, (e as Error).message);
      await updatePerson(id, (x) => ((x.status = "error"), (x.error = msg)));
      await logStep(id, "Failed", msg);
    }
  });
}

/** If the person didn't state their gender on the form, the agent infers it from the two sources. */
export async function ensureGender(id: string) {
  const p = (await getPerson(id))!;
  if (p.gender && p.seeking) return;
  if (!p.linkedin || !p.instagram) return;
  const { gender, evidence } = await inferGender(p.linkedin, p.instagram);
  await updatePerson(id, (x) => ((x.gender = gender), (x.seeking = defaultSeeking(gender)), (x.genderSource = "inferred"), (x.genderEvidence = evidence)));
  await logStep(id, `Identified as ${gender === "unknown" ? "gender unknown" : `a ${gender}`}, looking for ${defaultSeeking(gender)}`, evidence);
}

// ---------- Dating: the agent picks who to ask out, then goes on the dates ----------

const DATES_PER_PERSON = Number(process.env.DATES_PER_PERSON || 3);

/**
 * The agent reviews the pool and asks out its top k. Creates the date records (status "planning") and
 * returns them; the dates themselves are advanced step by step via advanceDate().
 */
export async function startDating(id: string, k = DATES_PER_PERSON, scene?: Scene): Promise<DateRecord[]> {
  const me = (await getPerson(id))!;
  const pool = (await listPeople()).filter((p) => p.status === "ready" && (p.id === id || compatible(me, p)));
  await updatePerson(id, (x) => (x.datingStatus = "choosing"));
  await logStep(id, "Agent is reviewing the pool", `${pool.length - 1} compatible people`);
  try {
    const { shortlist, invite } = await chooseDates(me, pool, k);
    const recs: DateRecord[] = [];
    for (const inv of invite) {
      const key = pairId(id, inv.id);
      // One date per pair: if the other agent already asked us out, reuse that date.
      const existing = await getDate(key);
      if (existing && existing.status !== "error") {
        recs.push(existing);
        continue;
      }
      const rec: DateRecord = { id: key, a: id, b: inv.id, scene, createdAt: Date.now(), status: "planning", messages: [], debriefs: {} };
      await saveDate(rec);
      recs.push(rec);
    }
    const names = await Promise.all(invite.map(async (i) => (await getPerson(i.id))?.analysis?.name ?? i.id));
    await updatePerson(id, (x) => ((x.shortlist = shortlist), (x.datingStatus = "dating")));
    await logStep(id, "Asked out", names.join(", "));
    return recs;
  } catch (e) {
    // Leave the profile clean so the visitor can simply try again.
    await updatePerson(id, (x) => {
      x.datingStatus = x.shortlist?.length ? "done" : "idle";
      if (x.log.at(-1)?.step === "Agent is reviewing the pool") x.log.pop();
    });
    throw e;
  }
}

/** Advance one date by one step, guarded by a lock so concurrent viewers don't double-step it. */
export async function advanceDate(dateId: string): Promise<DateRecord | null> {
  const rec = await getDate(dateId);
  if (!rec || rec.status === "done") return rec;
  if (!(await tryLock(`date:${dateId}`))) return rec; // someone else is stepping it; caller just polls
  try {
    const next = await stepDate(rec);
    if (next.status === "done") {
      for (const pid of [next.a, next.b]) {
        const mine = (await listDates()).filter((d) => d.a === pid || d.b === pid);
        const p = await getPerson(pid);
        if (p?.datingStatus === "dating" && mine.every((d) => d.status === "done")) await updatePerson(pid, (x) => (x.datingStatus = "done"));
      }
    }
    return next;
  } finally {
    await unlock(`date:${dateId}`);
  }
}

/** Script helper: choose dates then run each to completion. */
export async function sendOnDates(id: string, k = DATES_PER_PERSON, scene?: Scene) {
  try {
    const recs = await startDating(id, k, scene);
    await Promise.all(recs.map((r) => (r.status === "done" ? r : runDate(r))));
    await updatePerson(id, (x) => (x.datingStatus = "done"));
    await logStep(id, "All dates finished", "rankings updated");
  } catch (e) {
    await updatePerson(id, (x) => (x.datingStatus = "error"));
    await logStep(id, "Dating failed", friendlyError(e));
  }
}

// ---------- Ranking ----------

/**
 * For every person, rank everyone else. Real dates dominate: score = mean of BOTH agents' "overall"
 * (+5 if both want a second date). Candidates without a date fall back to the pre-date interest
 * (from either agent's shortlist), scaled down so actual dates rank first when they went well.
 */
export async function rankingsFor(id: string, ctx?: { people: Person[]; dates: DateRecord[] }): Promise<RankingRow[]> {
  const allPeople = ctx?.people ?? (await listPeople());
  const allDates = ctx?.dates ?? (await listDates());
  const me = allPeople.find((p) => p.id === id) ?? (await getPerson(id));
  const people = allPeople.filter((p) => p.status === "ready" && p.id !== id && (!me || compatible(me, p)));
  const dates = new Map(allDates.filter((d) => (d.a === id || d.b === id) && d.status === "done").map((d) => [d.a === id ? d.b : d.a, d]));
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
