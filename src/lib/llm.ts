// LLM client over free-tier Gemini + Groq models. Every model has its own quota, so calls rotate across a
// pool of "targets"; a target that returns 429/503 is cooled down and the call moves to the next one.

export type Provider = "gemini" | "groq";
export type Tier = "smart" | "fast"; // smart: analysis/judgement, fast: date chat turns

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  system: string;
  messages: ChatMessage[];
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  images?: { mimeType: string; data: string }[]; // base64, attached to the last user message (Gemini only)
  tier?: Tier;
}

interface Target {
  provider: Provider;
  model: string;
  tiers: Tier[];
  vision: boolean;
  cooldownUntil: number;
  active: number;
  max: number;
}

const list = (v: string | undefined, d: string) => (v || d).split(",").map((s) => s.trim()).filter(Boolean);

function buildTargets(): Target[] {
  const t: Target[] = [];
  if (process.env.GEMINI_API_KEY) {
    for (const model of list(process.env.GEMINI_SMART_MODELS, "gemini-3.5-flash,gemini-2.5-flash,gemini-3.5-flash-lite"))
      t.push({ provider: "gemini", model, tiers: ["smart", "fast"], vision: true, cooldownUntil: 0, active: 0, max: 2 });
    for (const model of list(process.env.GEMINI_FAST_MODELS, "gemini-2.5-flash-lite"))
      t.push({ provider: "gemini", model, tiers: ["fast"], vision: true, cooldownUntil: 0, active: 0, max: 3 });
  }
  if (process.env.GROQ_API_KEY) {
    for (const model of list(process.env.GROQ_SMART_MODELS, "openai/gpt-oss-120b"))
      t.push({ provider: "groq", model, tiers: ["smart", "fast"], vision: false, cooldownUntil: 0, active: 0, max: 2 });
    for (const model of list(process.env.GROQ_FAST_MODELS, "openai/gpt-oss-20b,qwen/qwen3.8-27b"))
      t.push({ provider: "groq", model, tiers: ["fast"], vision: false, cooldownUntil: 0, active: 0, max: 2 });
  }
  if (!t.length) throw new Error("No LLM key configured. Set GEMINI_API_KEY and/or GROQ_API_KEY.");
  return t;
}

let targets: Target[] | null = null;
let rr = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class RetryableError extends Error {
  constructor(public cooldownMs: number, msg: string) {
    super(msg);
  }
}

async function callGemini(t: Target, o: ChatOptions): Promise<string> {
  const contents = o.messages.map((m, i) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [
      { text: m.content },
      ...(i === o.messages.length - 1 && o.images ? o.images.map((img) => ({ inlineData: img })) : []),
    ],
  }));
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${t.model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: o.system }] },
      contents,
      generationConfig: {
        temperature: o.temperature ?? 0.8,
        maxOutputTokens: o.maxTokens ?? 4096,
        ...(o.json ? { responseMimeType: "application/json" } : {}),
        ...(t.model.startsWith("gemini-2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (res.status === 429) throw new RetryableError(60_000, `${t.model} 429`);
  if (res.status >= 500) throw new RetryableError(15_000, `${t.model} ${res.status}`);
  if (!res.ok) throw new Error(`${t.model} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  const text = body.candidates?.[0]?.content?.parts
    ?.filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) throw new RetryableError(5_000, `${t.model} empty response`);
  return text;
}

async function callGroq(t: Target, o: ChatOptions): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: t.model,
      messages: [{ role: "system", content: o.system }, ...o.messages],
      temperature: o.temperature ?? 0.8,
      max_completion_tokens: o.maxTokens ?? 4096,
      ...(t.model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
      ...(t.model.includes("qwen") ? { reasoning_effort: "none" } : {}),
      ...(o.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (res.status === 429) {
    const ra = Number(res.headers.get("retry-after")) || 20;
    throw new RetryableError(ra * 1000, `${t.model} 429`);
  }
  if (res.status >= 500) throw new RetryableError(15_000, `${t.model} ${res.status}`);
  if (!res.ok) throw new Error(`${t.model} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  const text = body.choices?.[0]?.message?.content?.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (!text) throw new RetryableError(5_000, `${t.model} empty response`);
  return text;
}

function pick(o: ChatOptions, tried: Set<Target>): Target | null {
  targets ??= buildTargets();
  const tier = o.tier ?? "smart";
  const now = Date.now();
  const pool = targets.filter((t) => t.tiers.includes(tier) && !tried.has(t));
  const isReady = (t: Target) => t.cooldownUntil <= now && t.active < t.max;
  // Prefer vision models when images are attached; if they're all rate-limited, fall back to text-only.
  const visionReady = o.images?.length ? pool.filter((t) => t.vision && isReady(t)) : [];
  const ready = visionReady.length ? visionReady : pool.filter(isReady);
  if (!ready.length) return null;
  // Round-robin over ready targets, so load (and quota use) is spread out.
  rr = (rr + 1) % ready.length;
  return ready[rr];
}

export async function chat(o: ChatOptions): Promise<string> {
  const deadline = Date.now() + 240_000;
  let lastErr: unknown = new Error("no LLM target available");
  let tried = new Set<Target>();
  while (Date.now() < deadline) {
    const t = pick(o, tried);
    if (!t) {
      // All targets busy, cooling down, or already failed this round: wait and start a fresh round.
      await sleep(1500);
      if (targets!.filter((x) => x.tiers.includes(o.tier ?? "smart")).every((x) => tried.has(x))) tried = new Set();
      continue;
    }
    t.active++;
    try {
      return await (t.provider === "gemini" ? callGemini(t, o) : callGroq(t, o));
    } catch (e) {
      lastErr = e;
      if (e instanceof RetryableError) t.cooldownUntil = Date.now() + e.cooldownMs;
      tried.add(t);
      if (process.env.LLM_DEBUG) console.warn("[llm]", (e as Error).message);
    } finally {
      t.active--;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Chat expecting a JSON object back; tolerant of code fences / leading prose. */
export async function chatJson<T>(o: ChatOptions): Promise<T> {
  let raw = "";
  for (let i = 0; i < 3; i++) {
    raw = await chat({ ...o, json: true });
    try {
      return parseJsonLoose<T>(raw);
    } catch {
      /* retry */
    }
  }
  throw new Error(`LLM returned invalid JSON: ${raw.slice(0, 200)}`);
}

export function parseJsonLoose<T>(raw: string): T {
  const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
  }
}

/** Fetch an image URL and return base64 for vision input; null on failure (IG CDN URLs expire). */
export async function fetchImageB64(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4_000_000) return null;
    return { mimeType: res.headers.get("content-type")?.split(";")[0] || "image/jpeg", data: buf.toString("base64") };
  } catch {
    return null;
  }
}
