import { scrapeInstagram, scrapeLinkedIn, ScrapeError } from "../src/lib/scrape";

const [kind, link] = process.argv.slice(2);
(async () => {
  try {
    const p = kind === "ig" ? await scrapeInstagram(link) : await scrapeLinkedIn(link);
    console.log(JSON.stringify(p, null, 2).slice(0, 4000));
  } catch (e) {
    console.error("FAILED:", (e as Error).message, e instanceof ScrapeError ? e.attempts : "");
  }
})();
