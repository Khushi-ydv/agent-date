// Scrapes candidate (LinkedIn, Instagram) pairs into data/raw/<ig>.json, skipping ones already cached.
// LinkedIn rate-limits per IP, so requests are spaced out. Run: npx tsx scripts/scrape-candidates.ts
import { existsSync, readFileSync, writeFileSync } from "fs";
import { scrapeInstagram, scrapeLinkedIn, parseInstagramUsername, ScrapeError } from "../src/lib/scrape";
import { sleep } from "../src/lib/scrape/util";

const pairs: [string, string][] = JSON.parse(readFileSync("data/candidates.json", "utf8"));
const igCache = new Map<string, Awaited<ReturnType<typeof scrapeInstagram>>>();
(async () => {
 for (let pass = 1; pass <= Number(process.env.PASSES || 4); pass++) {
  console.log(`--- pass ${pass}`);
  for (const [li, ig] of pairs) {
    const id = parseInstagramUsername(ig);
    const file = `data/raw/${id}.json`;
    if (existsSync(file)) continue;
    try {
      const instagram = igCache.get(id) ?? (await scrapeInstagram(ig));
      igCache.set(id, instagram);
      if (!instagram.bio && !instagram.posts.length) throw new ScrapeError("instagram thin");
      const linkedin = await scrapeLinkedIn(li);
      const first = (n?: string) => (n ?? "").toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").trim().split(/\s+/)[0];
      if (first(linkedin.name) !== first(instagram.fullName))
        throw new ScrapeError(`identity mismatch: LinkedIn "${linkedin.name}" vs Instagram "${instagram.fullName}"`);
      if (/\*{3}/.test(linkedin.headline ?? "")) throw new ScrapeError(`LinkedIn profile is restricted/masked (likely a different person)`);
      writeFileSync(file, JSON.stringify({ linkedinUrl: li, instagramUrl: ig, linkedin, instagram }, null, 2));
      console.log(`OK   ${id}: ${linkedin.name} | ${instagram.posts.length} posts | li=${linkedin.method}`);
    } catch (e) {
      console.log(`FAIL ${id}: ${(e as Error).message} ${e instanceof ScrapeError ? e.attempts.slice(-1).join() : ""}`);
    }
    await sleep(Number(process.env.GAP_MS || 30000));
  }
 }
  console.log("DONE");
})();
