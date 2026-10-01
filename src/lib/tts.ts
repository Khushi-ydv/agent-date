// Neural text-to-speech via Groq-hosted Orpheus (canopylabs/orpheus-v1-english), free tier.
import type { DateRecord, Person } from "./types";

const MODEL = process.env.TTS_MODEL || "canopylabs/orpheus-v1-english";
const WOMEN = ["diana", "hannah", "autumn"];
const MEN = ["daniel", "austin", "troy"];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** A stable voice per person (by gender), guaranteed different from their date's voice. */
export function voicesForDate(d: DateRecord, pa?: Person | null, pb?: Person | null): Record<string, string> {
  const pick = (p: Person | null | undefined, id: string, avoid?: string) => {
    const pool = p?.gender === "woman" ? WOMEN : p?.gender === "man" ? MEN : [...WOMEN, ...MEN];
    const start = hash(id) % pool.length;
    for (let k = 0; k < pool.length; k++) if (pool[(start + k) % pool.length] !== avoid) return pool[(start + k) % pool.length];
    return pool[start];
  };
  const va = pick(pa, d.a);
  return { [d.a]: va, [d.b]: pick(pb, d.b, va) };
}

/** Synthesize speech as WAV. Rotates across comma-separated Groq keys on rate limits. */
export async function synthesize(text: string, voice: string): Promise<ArrayBuffer> {
  const keys = (process.env.GROQ_API_KEY ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  if (!keys.length) throw new Error("GROQ_API_KEY not set");
  let last = "";
  for (const key of keys) {
    const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, voice, input: text.slice(0, 1200), response_format: "wav" }),
      signal: AbortSignal.timeout(45_000),
    });
    if (res.ok) return res.arrayBuffer();
    last = `${res.status} ${(await res.text()).slice(0, 160)}`;
  }
  throw new Error(`tts failed: ${last}`);
}
