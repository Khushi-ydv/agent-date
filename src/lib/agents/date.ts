import { chat, chatJson, parseJsonLoose } from "../llm";
import { getDate, getPerson, saveDate } from "../store";
import { SCENES, type Analysis, type DateMessage, type DateRecord, type Debrief, type Person, type Scene } from "../types";

/** A compact card of a person — what one agent knows about a *candidate* before the date (public-facing). */
export function card(p: Person): string {
  const a = p.analysis!;
  return [
    `${a.name} — ${a.oneLiner}`,
    `Career: ${a.career?.role} (${a.career?.stage})`,
    `Hobbies: ${a.hobbies.map((h) => h.label).join(", ")}`,
    `Interests: ${a.interests.map((h) => h.label).join(", ")}`,
    `Values: ${a.values.map((h) => h.label).join(", ")}`,
    `Looking for: ${a.lookingFor}`,
  ].join("\n");
}

/** Everything an agent knows about its OWN client (private brief). */
function brief(a: Analysis): string {
  const ev = (xs: Analysis["needs"]) => xs.map((x) => `- ${x.label}: ${x.detail}`).join("\n");
  return `CLIENT: ${a.name}${a.location ? ` (${a.location})` : ""}
Who they are: ${a.summary}
Career: ${a.career?.role}; stage: ${a.career?.stage}; ambition: ${a.career?.ambition}
Needs from a partner:\n${ev(a.needs)}
Hobbies:\n${ev(a.hobbies)}
Interests:\n${ev(a.interests)}
Values:\n${ev(a.values)}
Personality: ${a.personality.map((t) => `${t.trait} ${t.score}/100`).join(", ")}
Lifestyle: ${a.lifestyle.map((l) => `${l.label}: ${l.value}`).join("; ")}
Communication style: ${a.communicationStyle}. Love language: ${a.loveLanguage}
Looking for: ${a.lookingFor}
Dealbreakers: ${a.dealbreakers.join("; ")}
Green flags they'd love: ${a.greenFlags.join("; ")}
Conversation hooks: ${a.conversationHooks.join("; ")}
Your voice when speaking for them: ${a.agentVoice}`;
}

// ---------- 1. Matchmaking: each agent chooses whom to ask out ----------

export async function chooseDates(me: Person, pool: Person[], k: number) {
  const others = pool.filter((p) => p.id !== me.id && p.analysis);
  const res = await chatJson<{ picks: { id: string; interest: number; reason: string }[] }>({
    tier: "smart",
    temperature: 0.4,
    maxTokens: 2500,
    system: `You are ${me.analysis!.name}'s personal dating agent. You know your client deeply. Review every candidate and score how promising a first date would be for YOUR client (0-100), judging needs, values, lifestyle and goals fit — not fame or status. Return JSON: {"picks":[{"id": string, "interest": number, "reason": string (one specific sentence)}]} with an entry for EVERY candidate, sorted best first.`,
    messages: [
      {
        role: "user",
        content: `YOUR CLIENT (private brief):\n${brief(me.analysis!)}\n\nCANDIDATES:\n${others
          .map((o) => `[id: ${o.id}]\n${card(o)}`)
          .join("\n\n")}`,
      },
    ],
  });
  const valid = new Set(others.map((o) => o.id));
  const picks = (res.picks ?? []).filter((p) => valid.has(p.id)).sort((x, y) => y.interest - x.interest);
  return { shortlist: picks, invite: picks.slice(0, k) };
}

// ---------- 2. The date ----------

const TURNS = Number(process.env.DATE_TURNS || 8); // total messages (alternating)

function agentSystem(me: Analysis, other: Person, venue: DateRecord["venue"]) {
  return `You are the AI dating agent for ${me.name}, out on a first date on their behalf with ${other.analysis!.name}'s agent.
You speak AS ${me.name}, in first person, as their stand-in — warm, natural, a real date conversation (2-4 sentences per turn, no speeches, no lists).
This is a DATE, not a networking event or a podcast. Talk like two people getting to know each other: what you do on a free Sunday, travel, food, family, what makes you laugh, what you want in a partner, how you handle conflict, what a relationship needs to work for you. Work can come up, but don't let it take over — steer back to life and to each other. A little flirting and humour is good if it fits your client. Avoid thought-leader jargon and quotable aphorisms; be concrete and personal.
Stay strictly truthful to your client's brief below; never invent biography. You may share opinions consistent with it.
Your private job on this date: find out if ${other.analysis!.name} fits your client's needs, values, lifestyle and dealbreakers. Ask real questions, follow up on what they say, share specifics from your client's life (from the brief), be playful where your client would be. By the middle of the date, ask at least one question that tests a NEED or DEALBREAKER of your client (e.g. how they balance work and a partner, what they want long-term). If something clashes, probe it honestly rather than glossing over it.
Setting: ${venue?.place} — ${venue?.activity}.

${brief(me)}

What you know about your date going in (their public card):
${card(other)}

Reply ONLY as JSON: {"say": string (what you say out loud), "thought": string (a one-sentence private note to yourself about what you just learned or are probing)}`;
}

const SCENE_HINT: Record<Scene, string> = {
  cafe: "a cosy café, coffee house, bakery or bookshop café",
  beach: "a beach or seaside spot",
  mountain: "the mountains, a hill trail, a lookout or a cabin",
  sunset: "somewhere to watch the sunset — a rooftop, a lake pier, a hilltop",
};

async function planVenue(a: Person, b: Person, scene?: Scene) {
  const v = await chatJson<NonNullable<DateRecord["venue"]>>({
    tier: "fast",
    temperature: 0.9,
    system: `You are ${a.analysis!.name}'s dating agent, planning a first date with ${b.analysis!.name}. ${
      scene
        ? `The date MUST take place at ${SCENE_HINT[scene]}. Make it specific and imaginative, and weave in something BOTH of them enjoy.`
        : `Pick a specific, imaginative, ROMANTIC first-date setting that plays to something BOTH of them enjoy outside of work. Choose the scene type from: ${SCENES.join(", ")}.`
    } Never a work event, panel, conference or office. Return JSON {"place": string, "activity": string, "why": string (one sentence naming the shared ground), "scene": one of ${JSON.stringify(SCENES)}}.`,
    messages: [{ role: "user", content: `${card(a)}\n\n${card(b)}` }],
  });
  v.scene = scene ?? (SCENES.includes(v.scene as Scene) ? v.scene : "cafe");
  return v;
}

async function speak(me: Person, other: Person, rec: DateRecord): Promise<{ say: string; thought: string }> {
  // The transcript from this agent's perspective: its own lines = assistant, the other's = user.
  const msgs = rec.messages.map((m) => ({
    role: (m.from === me.id ? "assistant" : "user") as "assistant" | "user",
    content: m.from === me.id ? JSON.stringify({ say: m.say, thought: m.thought }) : m.say,
  }));
  const remaining = TURNS - rec.messages.length;
  const cue =
    rec.messages.length === 0
      ? `(You arrive first. Open the date — greet ${other.analysis!.name} and break the ice using the setting.)`
      : remaining <= 2
        ? "(The date is wrapping up. Respond, and close warmly in your client's honest way.)"
        : null;
  if (cue) msgs.push({ role: "user", content: cue });
  if (msgs[0]?.role === "assistant") msgs.unshift({ role: "user", content: "(The date begins.)" });
  const raw = await chat({ tier: "fast", json: true, temperature: 0.9, maxTokens: 800, system: agentSystem(me.analysis!, other, rec.venue), messages: msgs });
  try {
    const j = parseJsonLoose<{ say: string; thought: string }>(raw);
    if (j.say) return { say: j.say, thought: j.thought ?? "" };
  } catch {
    /* fall through */
  }
  return { say: raw.replace(/^\{?"?say"?:?\s*/i, "").slice(0, 600), thought: "" };
}

async function debrief(me: Person, other: Person, rec: DateRecord): Promise<Debrief> {
  const transcript = rec.messages
    .map((m) => `${m.from === me.id ? `${me.analysis!.name} (you)` : other.analysis!.name}: ${m.say}`)
    .join("\n");
  return chatJson<Debrief>({
    tier: "smart",
    temperature: 0.3,
    maxTokens: 900,
    system: `You are ${me.analysis!.name}'s dating agent. You just went on a first date on their behalf. Debrief honestly for YOUR client — you are protecting their time, not being polite. Judge against their needs, values, lifestyle and dealbreakers, using what was actually said.
Calibrate like a discerning matchmaker: a pleasant but ordinary first date is 45-65; good chemistry with real shared values is 66-79; 80+ is rare and needs specific evidence of fit on needs AND lifestyle. Pleasant conversation alone is not compatibility — penalise clashes in lifestyle, pace, location, life stage or dealbreakers even if the talk was friendly. Only say secondDate: true if overall >= 70.
Return JSON: {"chemistry": 0-10, "valuesFit": 0-10, "lifestyleFit": 0-10, "goalsFit": 0-10, "overall": 0-100, "secondDate": boolean, "highlight": string (best moment, quote-specific), "concern": string (the biggest risk), "reportToHuman": string (2-3 sentences you'd text your client, first person, candid)}`,
    messages: [{ role: "user", content: `YOUR CLIENT:\n${brief(me.analysis!)}\n\nTHEIR CARD:\n${card(other)}\n\nSETTING: ${rec.venue?.place}\n\nTRANSCRIPT:\n${transcript}` }],
  });
}

/**
 * Advance a date by exactly ONE step (plan venue → one conversation turn → debriefs) and persist it.
 * Each step is a single short LLM call, so it fits comfortably in a serverless request; the browser
 * (or the seed script) calls this repeatedly until the date is done. Failures leave the date resumable.
 */
export async function stepDate(rec: DateRecord): Promise<DateRecord> {
  if (rec.status === "done") return rec;
  const a = (await getPerson(rec.a))!;
  const b = (await getPerson(rec.b))!;
  if (rec.status === "error") rec.status = rec.venue ? (rec.messages.length >= TURNS ? "debrief" : "live") : "planning";
  rec.error = undefined;
  if (rec.status === "planning" || !rec.venue) {
    rec.venue = await planVenue(a, b, rec.scene);
    rec.scene = rec.venue.scene;
    rec.status = "live";
  } else if (rec.messages.length < TURNS) {
    const me = rec.messages.length % 2 === 0 ? a : b;
    const other = me === a ? b : a;
    const { say, thought } = await speak(me, other, rec);
    rec.messages.push({ from: me.id, say, thought, t: Date.now() } satisfies DateMessage);
    rec.status = rec.messages.length >= TURNS ? "debrief" : "live";
  } else {
    rec.status = "debrief";
    const [da, db] = await Promise.all([debrief(a, b, rec), debrief(b, a, rec)]);
    rec.debriefs = { [a.id]: da, [b.id]: db };
    rec.status = "done";
  }
  await saveDate(rec);
  return rec;
}

/** Run a whole date to completion (used by scripts). Marks the date as errored if a step keeps failing. */
export async function runDate(rec: DateRecord): Promise<DateRecord> {
  await saveDate(rec);
  while (rec.status !== "done") {
    try {
      rec = await stepDate(rec);
    } catch (e) {
      rec.status = "error";
      rec.error = (e as Error).message;
      await saveDate(rec);
      return rec;
    }
  }
  return rec;
}
