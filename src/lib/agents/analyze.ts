import { chatJson, fetchImageB64 } from "../llm";
import type { InstagramProfile, LinkedInProfile } from "../scrape/types";
import type { Analysis } from "../types";

/** Render both scraped sources as a compact dossier the agent reads. Nothing else is given to it. */
export function dossier(li: LinkedInProfile, ig: InstagramProfile): string {
  const lines: string[] = [];
  lines.push("=== SOURCE 1: LINKEDIN (public profile) ===");
  lines.push(`Name: ${li.name ?? "?"}`);
  if (li.headline) lines.push(`Headline: ${li.headline}`);
  if (li.location) lines.push(`Location: ${li.location}`);
  if (li.followers) lines.push(`Followers: ${li.followers.toLocaleString()}`);
  if (li.about) lines.push(`About: ${li.about}`);
  if (li.experience.length)
    lines.push(`Experience:\n${li.experience.map((e) => `- ${[e.title, e.org].filter(Boolean).join(" @ ")}${e.start ? ` (${e.start}–${e.end ?? "now"})` : ""}`).join("\n")}`);
  if (li.education.length)
    lines.push(`Education:\n${li.education.map((e) => `- ${[e.title, e.org].filter(Boolean).join(", ")}${e.start ? ` (${e.start}–${e.end ?? ""})` : ""}`).join("\n")}`);
  if (li.languages.length) lines.push(`Languages: ${li.languages.join(", ")}`);
  if (li.posts.length) lines.push(`Recent posts/articles (titles):\n${li.posts.map((p) => `- [${p.kind}] ${p.text}`).join("\n")}`);
  if (li.activityText) lines.push(`Recent activity text: ${li.activityText.slice(0, 2000)}`);

  lines.push("\n=== SOURCE 2: INSTAGRAM (public profile) ===");
  lines.push(`Handle: @${ig.username}${ig.fullName ? ` (${ig.fullName})` : ""}`);
  if (ig.bio) lines.push(`Bio: ${ig.bio}`);
  if (ig.category) lines.push(`Category: ${ig.category}`);
  lines.push(`Followers: ${ig.followers?.toLocaleString() ?? "?"} · Following: ${ig.following ?? "?"} · Posts: ${ig.postsCount ?? "?"}`);
  if (ig.externalUrl) lines.push(`Link in bio: ${ig.externalUrl}`);
  if (ig.posts.length)
    lines.push(
      `Last ${ig.posts.length} post captions:\n${ig.posts
        .map((p, i) => `${i + 1}. ${(p.caption || "(no caption)").replace(/\s+/g, " ").slice(0, 400)}`)
        .join("\n")}`
    );
  return lines.join("\n");
}

const SYSTEM = `You are a personal dating agent. You have just been assigned a new human client and you will date on their behalf.
Before you can represent them, you must understand them deeply. Your ONLY sources are their public LinkedIn and public Instagram, given below (plus a few of their Instagram photos when available). Use nothing else — no outside knowledge about them, even if they are famous.

Read like a perceptive friend, not a recruiter. LinkedIn tells you about ambition, career stage, what they're proud of and how they present professionally. Instagram tells you about how they actually spend their time, what lights them up, their aesthetic, humour, relationships and lifestyle. Notice tensions between the two (e.g. polished LinkedIn, goofy Instagram). Infer needs carefully: what would this person need from a partner to feel understood, respected and happy?

Rules:
- Every needs/hobbies/interests/values item must cite concrete evidence ("detail") and its source: "linkedin", "instagram" or "both".
- Confidence 0-1: be honest; low confidence for inferences, high for things they state outright.
- You are building a DATING profile, not a CV. Look past the professional content for the personal: sports, food, travel, family, pets, music, humour, rituals, places they go. Instagram photos and casual captions are your best evidence for this.
- Hobbies = things they DO for fun (activities), not their job — "podcasting" only counts if it's clearly a pastime; prefer what photos/captions show they do off the clock. Interests = topics they care about. Values = principles that guide them. Needs = what they need from a partner/relationship.
- Personality: Big Five (Openness, Conscientiousness, Extraversion, Agreeableness, Emotional stability), 0-100, with a short note grounded in evidence.
- readingNotes: 5-8 short first-person observations you made while reading, in order (e.g. "Their LinkedIn headline leads with mission, not title — purpose matters to them."). These are shown to the user as your reasoning.
- agentVoice: how YOU will sound when you speak for them on dates (tone, humour, vocabulary).
- Don't invent facts like age, relationship status or orientation; use ageRange only if strongly implied, else "unknown".
Return ONLY JSON matching this TypeScript type:
{
  "name": string, "oneLiner": string, "summary": string, "location": string, "ageRange": string,
  "career": {"role": string, "stage": string, "ambition": string},
  "needs": Evidenced[] (4-6), "hobbies": Evidenced[] (3-7), "interests": Evidenced[] (4-8), "values": Evidenced[] (3-6),
  "personality": {"trait": string, "score": number, "note": string}[] (exactly 5),
  "lifestyle": {"label": string, "value": string}[] (5: Pace, Social energy, Fitness, Travel, Work-life),
  "communicationStyle": string, "loveLanguage": string, "lookingFor": string,
  "greenFlags": string[] (3-5), "watchOuts": string[] (2-3), "dealbreakers": string[] (2-4),
  "idealFirstDate": string, "conversationHooks": string[] (3-5), "agentVoice": string, "readingNotes": string[]
}
where Evidenced = {"label": string, "detail": string, "source": "linkedin"|"instagram"|"both", "confidence": number}`;

export async function analyzePerson(li: LinkedInProfile, ig: InstagramProfile): Promise<Analysis> {
  // Give the agent a look at up to 4 recent photos (vision models only; skipped silently if unavailable).
  const imgs = (
    await Promise.all(ig.posts.filter((p) => p.imageUrl).slice(0, 4).map((p) => fetchImageB64(p.imageUrl!)))
  ).filter((x): x is NonNullable<typeof x> => !!x);

  const a = await chatJson<Analysis>({
    tier: "smart",
    temperature: 0.5,
    maxTokens: 6000,
    system: SYSTEM,
    images: imgs,
    messages: [
      {
        role: "user",
        content: `${dossier(li, ig)}\n\n${imgs.length ? `(${imgs.length} recent Instagram photos attached, in post order.)\n` : ""}Analyze your new client now.`,
      },
    ],
  });
  a.name ||= li.name || ig.fullName || ig.username;
  for (const k of ["needs", "hobbies", "interests", "values"] as const) a[k] = Array.isArray(a[k]) ? a[k] : [];
  return a;
}
