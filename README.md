# ♥ Proxy Hearts — agents that date for you

> Paste a LinkedIn + public Instagram. An AI agent reads the person, builds an evidence-backed dating profile, goes on real turn-by-turn first dates with other people's agents, and ranks who fits best.

**UI:** a romantic dusk theme with floating hearts, 3D heart-frame portraits and bubbly 3D icons, a "date stage" where each person's AI twin talks in speech bubbles over the chosen scenery (with optional browser text-to-speech voices and a ▶ replay), and an "It's a match!" burst when both agents want a second date.

**Pages:** `/` pool + "paste links" form · `/p/[id]` profile analysis, dates and ranking · `/date/[id]` live date transcript with the agents' private notes and debriefs · `/rankings` everyone's top matches · `/dates` every date · `/how` how it works.

## How it works

```
LinkedIn (public)  +  Instagram (public)      ← the ONLY two sources
            │
      1. Scrape ── src/lib/scrape/*
            │
      2. Agent reads & analyzes ── src/lib/agents/analyze.ts
         needs · hobbies · interests · values (each with evidence + source + confidence),
         Big Five, lifestyle, dealbreakers, conversation hooks, the agent's reading notes
            │
      3. Agent chooses dates ── gender/preference filter (stated on the form, or inferred from the
         two sources with a quoted citation) → chooseDates(): scores every compatible card, asks out
         its top 3; the user picks the scene (café / beach / mountain / sunset) or lets agents choose
            │
      4. Agents date ── runDate(): venue planned from shared hobbies → 8 alternating turns.
         Each side is a separate LLM call that sees ONLY its own client's private brief
         + the other's public card. Speaks as its client's stand-in, probes needs/dealbreakers,
         keeps a private note per turn.
            │
      5. Debrief ── each agent privately scores chemistry/values/lifestyle/goals (calibrated:
         pleasant ≠ compatible), decides on a second date, and texts its human a candid report
            │
      6. Rank ── for each person, everyone else: dated = mean of BOTH agents' verdicts
         (+5 if both want a 2nd date); undated = pre-date interest × 0.85
```

## Scraping (tech)

| Source | Strategy chain (first that works wins) |
|---|---|
| **Instagram** | 1. Public profile HTML served to search crawlers (Googlebot/Bingbot UA) → embedded JSON: name, bio, followers, verified/private flags, last 12 posts with captions + image URLs. 2. Instagram web API (`web_profile_info`). 3. Apify `apify/instagram-profile-scraper` (if `APIFY_TOKEN`). Private accounts are rejected. |
| **LinkedIn** | 1. Public profile page as served to Googlebot → schema.org JSON-LD (`Person`, articles, posts) + public sections (about, experience, education, activity). 2. Same page via **Jina Reader** (`r.jina.ai`) when LinkedIn rate-limits our IP (429/999). 3. Bright Data LinkedIn Profiles API (if `BRIGHTDATA_API_KEY`). 4. Apify no-cookie LinkedIn actor (if `APIFY_TOKEN`). No login/cookies are ever used. |

Identity check: if the LinkedIn and Instagram names don't match (or LinkedIn returns a masked profile), the agent flags it in its reading log.

## LLMs

Free tiers only. `src/lib/llm.ts` rotates calls across a pool of models, each with its own quota, and cools down any model that returns 429:
Gemini 3.5 Flash / 2.5 Flash (analysis, vision on 4 Instagram photos, judgement) · Gemini Flash-Lite + Groq `gpt-oss-120b`, `gpt-oss-20b`, `qwen3` (date turns).

## Stack

Next.js 16 (App Router, route handlers + `after()` background jobs) · TypeScript · Tailwind v4 · JSON file store (`data/`) · deploy: Render (long-running Node server).

## Deploy (Vercel)

1. Import the GitHub repo at vercel.com/new (framework: Next.js, no extra settings).
2. Project → Storage → add **Upstash Redis** (free) and connect it — this injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`. The bundled demo pool is read from `data/`; new profiles and dates are written to Redis.
3. Add env vars: `GEMINI_API_KEY`, `GROQ_API_KEY` (comma-separate several keys to pool free quotas), optionally `BRIGHTDATA_API_KEY` / `APIFY_TOKEN`.
4. Deploy. Dates advance one short LLM step per request (`/api/dates/[id]/step`), driven by the open page — no long-running background jobs, so it fits serverless limits and is resumable.

## Run locally

```bash
cp .env.example .env.local   # add GEMINI_API_KEY and/or GROQ_API_KEY (both free)
npm install
npm run dev                  # http://localhost:3000
```

Rebuild the demo pool (same pipeline as the website):

```bash
npx tsx scripts/scrape-candidates.ts                       # data/candidates.json → data/raw/
npx tsx --env-file=.env.local scripts/seed.ts analyze      # raw → analyzed people
npx tsx --env-file=.env.local scripts/seed.ts date         # every agent picks & goes on dates
```

## Notes

Built only from public profiles of public figures, for a demo. Agents speak *as stand-ins*; nothing in a transcript was said by the real people.
