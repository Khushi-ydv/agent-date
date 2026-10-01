import { chatJson } from "../llm";
import type { InstagramProfile, LinkedInProfile } from "../scrape/types";
import type { Gender, Person, Seeking } from "../types";

/** Infer gender from the two sources only (pronouns field, bio, how captions/posts refer to them). */
export async function inferGender(li: LinkedInProfile, ig: InstagramProfile): Promise<{ gender: Gender; evidence: string }> {
  const text = [
    `Name: ${li.name ?? ig.fullName}`,
    li.headline && `LinkedIn headline: ${li.headline}`,
    li.about && `LinkedIn about: ${li.about.slice(0, 600)}`,
    li.activityText && `LinkedIn activity: ${li.activityText.slice(0, 800)}`,
    ig.bio && `Instagram bio: ${ig.bio}`,
    `Instagram captions: ${ig.posts.map((p) => p.caption.slice(0, 200)).join(" | ").slice(0, 1500)}`,
  ]
    .filter(Boolean)
    .join("\n");
  const r = await chatJson<{ gender: Gender; evidence: string }>({
    tier: "fast",
    temperature: 0,
    system:
      'From ONLY the profile text given (never outside or "public" knowledge about the person, even if famous), determine the person\'s gender as presented publicly. Use pronouns, self-descriptions (e.g. "Mother", "husband", "dad", "she/her"), how others refer to them in captions, and their name. Return JSON {"gender": "man" | "woman" | "unknown", "evidence": string (one short sentence quoting what in the text you used)}.',
    messages: [{ role: "user", content: text }],
  });
  return { gender: ["man", "woman"].includes(r.gender) ? r.gender : "unknown", evidence: r.evidence ?? "" };
}

/** Default preference when the person didn't state one: opposite gender. */
export const defaultSeeking = (g?: Gender): Seeking => (g === "man" ? "women" : g === "woman" ? "men" : "everyone");

const wants = (seeking: Seeking | undefined, g: Gender | undefined) =>
  !seeking || seeking === "everyone" || !g || g === "unknown" ? true : seeking === (g === "man" ? "men" : "women");

/** Both people must be open to each other. */
export const compatible = (a: Person, b: Person) => wants(a.seeking, b.gender) && wants(b.seeking, a.gender);
