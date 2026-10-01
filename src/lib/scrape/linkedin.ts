import { runApifyActor } from "./apify";
import { LinkedInProfile, ScrapeError } from "./types";
import { UA, decodeHtml, fetchText, sleep, stripTags } from "./util";

export function parseLinkedInSlug(input: string): string {
  const m = input.trim().match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (!m) throw new ScrapeError(`Not a valid LinkedIn profile link (expected linkedin.com/in/...): ${input}`);
  return decodeURIComponent(m[1]).replace(/\/$/, "");
}

const pickYear = (v: unknown) => (v == null || v === "" ? undefined : (v as string | number));

/**
 * Strategy 1: public profile page as served to search-engine crawlers.
 * Contains schema.org JSON-LD (Person + their posts/articles) and the rendered public sections.
 * LinkedIn intermittently answers with a JS challenge / 999 / 429, so the caller retries.
 */
async function viaPublicPage(slug: string): Promise<LinkedInProfile> {
  const url = `https://www.linkedin.com/in/${encodeURIComponent(slug)}`;
  const { status, text: h } = await fetchText(url, {
    "User-Agent": UA.googlebot,
    "Accept-Language": "en-US,en;q=0.9",
    Accept: "text/html",
  });
  if (status === 404) throw new ScrapeError(`LinkedIn profile ${slug} not found`);
  const ld = h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (status !== 200 || !ld) throw new Error(`public page ${status}${ld ? "" : " (blocked/challenge)"}`);
  return parseLinkedInHtml(h, slug, url);
}

export function parseLinkedInHtml(h: string, slug: string, url: string): LinkedInProfile {
  const ld = h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!ld) throw new Error("no JSON-LD");
  const data = JSON.parse(ld[1]);
  const graph: any[] = data["@graph"] ?? [data];
  const person = graph.find((g) => g["@type"] === "Person");
  if (!person) throw new Error("no Person in JSON-LD");

  // Public sections in the rendered HTML (fuller than JSON-LD for about/experience).
  const section = (name: string) => {
    const m = h.match(new RegExp(`<section[^>]*data-section="${name}"[^>]*>([\\s\\S]*?)</section>`));
    return m ? stripTags(m[1]) : undefined;
  };
  // Logged-out pages append the sign-in modal text ("… see more Welcome back Email or phone …") to sections.
  const cutModal = (t?: string) => t?.split(/\s*(?:… see more|see more)?\s*Welcome back\b/)[0];
  const aboutHtml = cutModal(section("summary")?.replace(/^About\s+/, ""));
  const metaDesc = h.match(/<meta name="description" content="([^"]*)"/)?.[1];
  const ogTitle = h.match(/<meta property="og:title" content="([^"]*)"/)?.[1];

  const experience = (person.worksFor ?? [])
    .filter((w: any) => w.name)
    .map((w: any) => ({ org: w.name, title: undefined, start: pickYear(w.member?.startDate), end: pickYear(w.member?.endDate) }));
  // Rendered experience items; keep only ones with real text (logged-out view often blanks titles to "-").
  const expItems = [...h.matchAll(/<li[^>]*class="[^"]*experience-item[^"]*"[^>]*>([\s\S]*?)<\/li>/g)]
    .map((m) => stripTags(m[1]).replace(/(\s*-\s*)+$/, ""))
    .filter((t) => /[A-Za-z]{3}/.test(t) && !/^Education\b/.test(t));
  const activityText = section("posts")
    ?.replace(/^Activity\s+[\d.,]+[KMB]? followers\s+Posts Comments Reactions\s*(No more previous content)?/i, "")
    .replace(/Report this (post|comment)|public_profile_\w+|\d+\s+\d+\s+Comments|Copy LinkedIn Facebook X/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 3000);
  const education = (person.alumniOf ?? []).filter((e: any) => e.name).map((e: any) => ({
    org: e.name,
    start: pickYear(e.member?.startDate),
    end: pickYear(e.member?.endDate),
  }));
  const posts = graph
    .filter((g) => ["Article", "DiscussionForumPosting", "SocialMediaPosting"].includes(g["@type"]))
    .map((g) => ({
      kind: g["@type"] === "Article" ? "article" : "post",
      text: decodeHtml(String(g.headline ?? g.articleBody ?? g.text ?? "")).slice(0, 600),
      date: g.datePublished,
    }))
    .filter((p) => p.text);

  const titles = [...new Set<string>((person.jobTitle ?? []).filter(Boolean))].slice(0, 3);
  return {
    source: "linkedin",
    method: "linkedin-public-page (json-ld)",
    slug,
    url,
    name: person.name,
    headline: titles.length ? titles.join(" · ") : ogTitle ? decodeHtml(ogTitle).replace(/\s*\|\s*LinkedIn\s*$/, "") : undefined,
    about: aboutHtml || (person.description ? decodeHtml(person.description) : metaDesc ? decodeHtml(metaDesc) : undefined),
    location: person.address?.addressLocality,
    profilePic: person.image?.contentUrl,
    followers: person.interactionStatistic?.userInteractionCount,
    experience: expItems.length ? expItems.slice(0, 8).map((t) => ({ title: t.slice(0, 200) })) : experience,
    education,
    languages: (person.knowsLanguage ?? []).map((l: any) => l.name ?? String(l)),
    posts: posts.slice(0, 10),
    activityText: activityText || undefined,
  };
}

/**
 * Strategy 2: same public page, fetched through Jina Reader (r.jina.ai) so the request comes from Jina's IPs
 * instead of ours. Free without a key (~20 req/min); JINA_API_KEY raises limits.
 */
async function viaJina(slug: string): Promise<LinkedInProfile> {
  const url = `https://www.linkedin.com/in/${encodeURIComponent(slug)}`;
  const headers: Record<string, string> = { "X-Return-Format": "html", "X-No-Cache": "true" };
  if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`;
  const { status, text } = await fetchText(`https://r.jina.ai/${url}`, headers, 60_000);
  if (status !== 200) throw new Error(`jina ${status}`);
  if (/Page not found|profile-unavailable/i.test(text) && !text.includes("ld+json")) throw new ScrapeError(`LinkedIn profile ${slug} not found`);
  const p = parseLinkedInHtml(text, slug, url);
  return { ...p, method: "linkedin-public-page via jina reader" };
}

/** Strategy 3: Apify LinkedIn profile actor (no cookies needed). Only if APIFY_TOKEN is set. */
async function viaApify(slug: string): Promise<LinkedInProfile> {
  const actor = process.env.APIFY_LINKEDIN_ACTOR || "harvestapi/linkedin-profile-scraper";
  const url = `https://www.linkedin.com/in/${slug}`;
  const items = await runApifyActor<any>(actor, { urls: [url], profileUrls: [url], queries: [url] });
  const p = items[0];
  if (!p) throw new Error("apify: no result");
  const exp = p.experience ?? p.experiences ?? p.positions ?? [];
  const edu = p.education ?? p.educations ?? [];
  return {
    source: "linkedin",
    method: `apify/${actor}`,
    slug,
    url,
    name: p.fullName ?? [p.firstName, p.lastName].filter(Boolean).join(" "),
    headline: p.headline ?? p.occupation,
    about: p.about ?? p.summary,
    location: p.location?.linkedinText ?? p.location?.default ?? p.addressWithCountry ?? p.location,
    profilePic: p.profilePicture?.url ?? p.profilePic ?? p.photo,
    followers: p.followerCount ?? p.followers,
    experience: exp.slice(0, 8).map((e: any) => ({
      title: e.position ?? e.title,
      org: e.companyName ?? e.company ?? e.subtitle,
      start: e.startDate?.text ?? e.startDate,
      end: e.endDate?.text ?? e.endDate,
    })),
    education: edu.slice(0, 5).map((e: any) => ({
      title: e.degree ?? e.subtitle,
      org: e.schoolName ?? e.title,
      start: e.startDate?.text,
      end: e.endDate?.text,
    })),
    languages: (p.languages ?? []).map((l: any) => l.name ?? l.title ?? String(l)),
    posts: [],
  };
}

/**
 * Strategy 4: Bright Data LinkedIn Profiles Scraper API (sync, by URL). Only if BRIGHTDATA_API_KEY is set.
 * Free account: monthly free credits, no card. Dataset id = "LinkedIn people profiles - collect by URL".
 */
async function viaBrightData(slug: string): Promise<LinkedInProfile> {
  const key = process.env.BRIGHTDATA_API_KEY!;
  const dataset = process.env.BRIGHTDATA_LINKEDIN_DATASET || "gd_l1viktl72bvl7bjuj0";
  const url = `https://www.linkedin.com/in/${slug}`;
  const res = await fetch(
    `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${dataset}&format=json&include_errors=true`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: [{ url }] }),
      signal: AbortSignal.timeout(120_000),
    }
  );
  if (!res.ok) throw new Error(`brightdata ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const p = Array.isArray(body) ? body[0] : body;
  if (!p || p.error || p.snapshot_id) throw new Error(`brightdata: ${p?.error ?? (p?.snapshot_id ? "async snapshot (timed out sync)" : "no result")}`);
  return {
    source: "linkedin",
    method: "brightdata/linkedin-profiles",
    slug,
    url,
    name: p.name,
    headline: p.position ?? p.headline,
    about: p.about,
    location: p.city ?? p.location,
    profilePic: p.avatar,
    followers: p.followers,
    experience: (p.experience ?? []).slice(0, 8).map((e: any) => ({
      title: e.title,
      org: e.company,
      start: e.start_date,
      end: e.end_date,
    })),
    education: (p.education ?? []).slice(0, 5).map((e: any) => ({
      title: e.degree ?? e.field,
      org: e.title,
      start: e.start_year,
      end: e.end_year,
    })),
    languages: (p.languages ?? []).map((l: any) => l.title ?? l.name ?? String(l)),
    posts: [...(p.posts ?? []), ...(p.activity ?? [])]
      .slice(0, 10)
      .map((a: any) => ({ kind: "post", text: String(a.title ?? a.attribution ?? "").slice(0, 600), date: a.created_at }))
      .filter((a) => a.text),
  };
}

export async function scrapeLinkedIn(input: string): Promise<LinkedInProfile> {
  const slug = parseLinkedInSlug(input);
  const attempts: string[] = [];
  // LinkedIn's crawler response is flaky and rate-limited per IP, so retry with backoff.
  const tries = Number(process.env.LINKEDIN_FREE_TRIES) || 2;
  for (let i = 0; i < tries; i++) {
    try {
      return await viaPublicPage(slug);
    } catch (e) {
      if (e instanceof ScrapeError) throw e;
      attempts.push(`public-page#${i + 1}: ${(e as Error).message}`);
      await sleep(1500 * (i + 1) + Math.random() * 1000);
    }
  }
  const fallbacks: [string, string | undefined, () => Promise<LinkedInProfile>][] = [
    // Jina intermittently gets LinkedIn's authwall instead of the profile; retrying a few seconds later usually works.
    ...[0, 4000, 8000, 12000].map((wait, i): [string, string, () => Promise<LinkedInProfile>] => [
      `jina#${i + 1}`,
      "always",
      () => sleep(wait).then(() => viaJina(slug)),
    ]),
    ["brightdata", process.env.BRIGHTDATA_API_KEY, () => viaBrightData(slug)],
    ["apify", process.env.APIFY_TOKEN, () => viaApify(slug)],
  ];
  for (const [name, enabled, fn] of fallbacks) {
    if (!enabled) continue;
    try {
      return await fn();
    } catch (e) {
      attempts.push(`${name}: ${(e as Error).message}`);
    }
  }
  throw new ScrapeError(`Could not read LinkedIn profile ${slug}`, attempts);
}
