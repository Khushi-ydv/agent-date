"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Heart } from "@/components/FloatingHearts";
import { HeartFrame, Icon3D } from "@/components/Love3D";
import { ScoreRing } from "@/components/MatchBurst";
import { SCENE_META, ScenePicker, type SceneKey } from "@/components/ScenePicker";
import type { Analysis, Debrief, Evidenced, LogEntry, RankingRow } from "@/lib/types";

interface Data {
  person: {
    id: string;
    status: string;
    datingStatus?: string;
    error?: string;
    photo?: string;
    gender?: string;
    seeking?: string;
    genderSource?: string;
    linkedinUrl: string;
    instagramUrl: string;
    log: LogEntry[];
    analysis?: Analysis;
    sources: {
      linkedin?: { name?: string; headline?: string; location?: string; method: string; experience: number; posts: number };
      instagram?: { username: string; bio?: string; followers?: number; method: string; posts: number; images: string[] };
    };
  };
  running: { ingest: boolean; dating: boolean };
  dates: { id: string; scene?: SceneKey; with: string; withName?: string; withPhoto?: string; initiatedByMe: boolean; status: string; venue?: { place: string; activity: string; why: string }; messages: number; myDebrief?: Debrief; theirDebrief?: Debrief }[];
  rankings: RankingRow[];
}

const SRC_ICON: Record<string, string> = { linkedin: "in", instagram: "◎", both: "✦" };
const SRC_CLR: Record<string, string> = { linkedin: "bg-sky-400/25 text-sky-200", instagram: "bg-fuchsia-400/25 text-fuchsia-200", both: "bg-amber-400/25 text-amber-100" };

function TagCloud({ title, icon, items, tint }: { title: string; icon: string; items: Evidenced[]; tint: string }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className={`glass pop p-5 ${tint}`}>
      <div className="mb-3 flex items-center gap-2 font-display text-xl italic"><span className="text-2xl not-italic">{icon}</span>{title}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((x, i) => (
          <button key={i} onClick={() => setOpen(open === i ? null : i)} title={x.detail} className={`pop inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${open === i ? "border-pink-300 bg-pink-500/25" : "border-white/10 bg-white/[0.07] hover:border-pink-300/50"}`} style={{ animationDelay: `${i * 70}ms` }}>
            <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${SRC_CLR[x.source] ?? SRC_CLR.both}`}>{SRC_ICON[x.source] ?? "✦"}</span>
            {x.label}
          </button>
        ))}
      </div>
      {open !== null && items[open] && (
        <div className="pop mt-3 rounded-2xl bg-black/30 p-3 text-sm text-white/75">
          <span className="text-white/40">Evidence ({items[open].source}, {Math.round((items[open].confidence ?? 0.5) * 100)}% sure): </span>
          {items[open].detail}
        </div>
      )}
    </div>
  );
}

export function ProfileView({ id }: { id: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sending, setSending] = useState(false);
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/people/${id}`, { cache: "no-store" });
    if (res.status === 404) return setNotFound(true);
    setData(await res.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const busy = !!data && (data.running.ingest || data.running.dating || ["queued", "scraping", "analyzing"].includes(data.person.status) || data.dates.some((d) => !["done", "error"].includes(d.status)));
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [busy, load]);

  if (notFound) return <div className="glass p-8">No such person. <Link className="text-pink-300 underline" href="/">Back to the pool</Link></div>;
  if (!data) return <div className="flex justify-center py-32"><Heart size={48} className="beat text-pink-500" /></div>;

  const { person: p, dates, rankings } = data;
  const a = p.analysis;
  const name = a?.name ?? p.sources.linkedin?.name ?? p.id;
  const first = name.split(" ")[0];
  const reading = ["queued", "scraping", "analyzing"].includes(p.status);

  async function act(body: object) {
    setSending(true);
    await fetch(`/api/people/${id}/date`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setTimeout(() => setSending(false), 1500);
    load();
  }

  const podium = rankings.slice(0, 3);
  return (
    <div className="space-y-8">
      {picking && <ScenePicker name={first} onClose={() => setPicking(false)} onPick={(scene) => { setPicking(false); act({ scene }); }} />}
      {/* Banner */}
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/heart-hands.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#14061c] via-[#14061c]/80 to-[#14061c]/30" />
        <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:p-10">
          <div className="relative w-fit">
            <HeartFrame src={p.photo} name={name} size={190} />
            <Icon3D name="arrow-heart" size={64} delay={300} className="absolute -bottom-4 -right-6" />
          </div>
          <div className="flex-1 space-y-3">
            <h1 className="font-display text-5xl font-semibold">{name}</h1>
            {a && <p className="max-w-2xl font-display text-xl italic text-white/85">“{a.oneLiner}”</p>}
            <div className="flex flex-wrap gap-2 text-sm">
              {p.gender && p.gender !== "unknown" && <span className="chip">{p.gender === "woman" ? "♀ Woman" : "♂ Man"} · seeking {p.seeking}</span>}
              {a?.location && <span className="chip">📍 {a.location}</span>}
              {a?.ageRange && a.ageRange !== "unknown" && <span className="chip">🎂 {a.ageRange}</span>}
              <a href={p.linkedinUrl} target="_blank" className="chip hover:bg-white/15">in LinkedIn ↗</a>
              <a href={p.instagramUrl} target="_blank" className="chip hover:bg-white/15">◎ Instagram ↗</a>
            </div>
          </div>
          {p.status === "ready" && (
            <button className="btn shrink-0 text-lg" onClick={() => setPicking(true)} disabled={sending || data.running.dating}>
              <Heart className={data.running.dating ? "beat" : ""} />
              {data.running.dating ? (p.datingStatus === "choosing" ? "Choosing dates…" : "On dates…") : dates.length ? "More dates" : "Send my agent dating"}
            </button>
          )}
        </div>
      </section>

      {/* Reading */}
      <section className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
        <div className="glass p-6">
          <h2 className="mb-4 font-display text-2xl italic">🔎 How the agent read {first}</h2>
          <ol className="relative space-y-3 border-l-2 border-pink-500/30 pl-5">
            {p.log.filter((l) => !/^(Agent is reviewing|Asked out|All dates|Dating failed)/.test(l.step)).map((l, i) => (
              <li key={i} className="pop relative" style={{ animationDelay: `${i * 60}ms` }}>
                <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-gradient-to-r from-pink-500 to-orange-400 ring-4 ring-[#14061c]" />
                <div className="text-sm font-medium">{l.step}</div>
                {l.detail && <div className="line-clamp-2 text-xs text-white/45">{l.detail}</div>}
              </li>
            ))}
            {reading && <li className="relative text-sm text-pink-300"><span className="absolute -left-[27px] top-1 h-3 w-3 animate-ping rounded-full bg-pink-500" />reading… <span className="dot">●</span><span className="dot" style={{ animationDelay: ".2s" }}>●</span><span className="dot" style={{ animationDelay: ".4s" }}>●</span></li>}
          </ol>
          {p.status === "error" && (
            <div className="mt-4 space-y-2">
              <div className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-300">{p.error}</div>
              <button className="btn-ghost" onClick={() => act({ retry: true })} disabled={sending}>Try again</button>
            </div>
          )}
        </div>
        <div className="glass p-6">
          <h2 className="mb-4 font-display text-2xl italic">🧠 What the agent noticed</h2>
          {a ? (
            <div className="space-y-2">
              {a.readingNotes?.map((n, i) => (
                <div key={i} className="pop flex gap-3" style={{ animationDelay: `${i * 90}ms` }}>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-500 text-xs">🤖</div>
                  <div className="rounded-2xl rounded-tl-sm bg-white/[0.07] px-3 py-2 text-sm text-white/85">{n}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/50">{reading ? "The agent is scrolling through their posts…" : "Notes appear once the agent finishes reading."}</p>
          )}
          {!!p.sources.instagram?.images.length && (
            <div className="mt-4 grid grid-cols-6 gap-1.5">
              {p.sources.instagram.images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={`/api/img?u=${encodeURIComponent(src)}`} alt="" className="pop aspect-square w-full rounded-xl object-cover" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          )}
        </div>
      </section>

      {a && (
        <>
          {/* Essentials */}
          <section className="grid gap-4 md:grid-cols-3">
            {[["💘", "Looking for", a.lookingFor], ["🌅", "Dream first date", a.idealFirstDate], ["💝", "Love language", a.loveLanguage]].map(([icon, k, v]) => (
              <div key={k} className="glass lift p-5">
                <div className="text-3xl">{icon}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-pink-300/80">{k}</div>
                <div className="mt-1 text-white/85">{v}</div>
              </div>
            ))}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <TagCloud title="Needs" icon="💗" items={a.needs} tint="" />
            <TagCloud title="Hobbies" icon="🎯" items={a.hobbies} tint="" />
            <TagCloud title="Interests" icon="✨" items={a.interests} tint="" />
            <TagCloud title="Values" icon="🧭" items={a.values} tint="" />
          </section>
          <p className="-mt-4 text-center text-xs text-white/40">Tap any tag to see the evidence · <span className="text-sky-300">in</span> LinkedIn · <span className="text-fuchsia-300">◎</span> Instagram · <span className="text-amber-200">✦</span> both</p>

          <section className="grid gap-4 md:grid-cols-[1.1fr_1fr_1fr]">
            <div className="glass p-5">
              <div className="mb-3 font-display text-xl italic">Personality</div>
              {a.personality.map((t, i) => (
                <div key={t.trait} className="mb-2.5" title={t.note}>
                  <div className="flex justify-between text-sm"><span>{t.trait}</span><span className="text-white/50">{t.score}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="grow h-2 rounded-full bg-gradient-to-r from-pink-500 to-orange-300" style={{ width: `${t.score}%`, animationDelay: `${i * 120}ms` }} /></div>
                </div>
              ))}
            </div>
            <div className="glass p-5">
              <div className="mb-3 font-display text-xl italic">Lifestyle</div>
              <div className="grid grid-cols-1 gap-2">
                {a.lifestyle.map((l) => (
                  <div key={l.label} className="flex gap-3 rounded-2xl bg-black/20 p-2.5">
                    <span className="text-lg">{({ Pace: "⚡", "Social energy": "🎉", Fitness: "🏃", Travel: "✈️", "Work-life": "⚖️" } as Record<string, string>)[l.label] ?? "•"}</span>
                    <div><div className="text-[10px] uppercase tracking-wide text-white/40">{l.label}</div><div className="line-clamp-2 text-sm">{l.value}</div></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass space-y-4 p-5 text-sm">
              <Flags title="Green flags they'd love" items={a.greenFlags} cls="bg-emerald-400/15 text-emerald-200" />
              <Flags title="Dealbreakers" items={a.dealbreakers} cls="bg-red-400/15 text-red-200" />
              <Flags title="Conversation hooks" items={a.conversationHooks} cls="bg-violet-400/15 text-violet-200" />
            </div>
          </section>

          {/* Dates */}
          <section>
            <div className="mb-4 flex items-end justify-between">
              <h2 className="font-display text-4xl italic">💌 {first}&apos;s dates</h2>
              {data.running.dating && p.datingStatus === "choosing" && <span className="animate-pulse text-pink-300">Agent is flipping through every profile…</span>}
            </div>
            {!dates.length && !data.running.dating && (
              <div className="glass flex flex-col items-center gap-3 p-10 text-center">
                <Heart size={40} className="beat text-pink-500" />
                <div className="text-white/70">No dates yet. Send {first}&apos;s agent out — it will pick who to ask out and go on live dates.</div>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {dates.map((d) => {
                const done = d.status === "done" && d.myDebrief && d.theirDebrief;
                const mutual = done && d.myDebrief!.secondDate && d.theirDebrief!.secondDate;
                return (
                  <Link key={d.id} href={`/date/${d.id}`} className="glass lift pop relative block overflow-hidden p-5">
                    {d.scene && SCENE_META[d.scene] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={SCENE_META[d.scene].img} alt="" className="absolute inset-0 -z-0 h-full w-full object-cover opacity-25" />
                    )}
                    <div className="relative flex items-center gap-4">
                      <div className="flex -space-x-4">
                        <Avatar src={p.photo} name={name} size={52} />
                        <Avatar src={d.withPhoto} name={d.withName ?? d.with} size={52} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-lg">{first} <Heart size={12} className="inline text-pink-400" /> {d.withName ?? d.with}</div>
                        <div className="truncate text-xs text-white/50">📍 {d.venue?.place ?? "planning the date…"}</div>
                      </div>
                      {done ? <ScoreRing value={Math.round((d.myDebrief!.overall + d.theirDebrief!.overall) / 2)} size={56} /> : <span className="animate-pulse rounded-full bg-pink-500/20 px-3 py-1 text-xs text-pink-200">{d.status === "live" ? `● live · ${d.messages}` : d.status}</span>}
                    </div>
                    {mutual && <div className="relative mt-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-pink-500/30 to-orange-400/30 px-3 py-1 text-xs">💞 Both agents want a second date</div>}
                    {d.myDebrief && <p className="relative mt-3 line-clamp-2 text-sm italic text-white/70">📱 “{d.myDebrief.reportToHuman}”</p>}
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Rankings */}
          <section>
            <h2 className="mb-1 font-display text-4xl italic">🏆 Who fits {first} best</h2>
            <p className="mb-5 text-sm text-white/50">After the dates, both agents score each other — a match only ranks high if the spark is mutual.</p>
            {!!podium.length && (
              <div className="mb-5 grid gap-4 md:grid-cols-3">
                {podium.map((r, i) => (
                  <Link key={r.id} href={r.dateId ? `/date/${r.dateId}` : `/p/${r.id}`} className={`glass lift pop relative flex flex-col items-center p-6 text-center ${i === 0 ? "md:-translate-y-3 border-pink-400/40" : ""}`} style={{ animationDelay: `${i * 120}ms` }}>
                    <div className="absolute left-4 top-3 font-display text-3xl italic text-white/30">#{i + 1}</div>
                    {i === 0 && <div className="absolute right-4 top-3 text-2xl">👑</div>}
                    {i === 0 ? <HeartFrame src={r.photo} name={r.name} size={150} /> : <div className="rounded-full bg-gradient-to-tr from-pink-500 to-orange-300 p-1"><Avatar src={r.photo} name={r.name} size={88} /></div>}
                    <div className="mt-3 font-display text-xl">{r.name}</div>
                    <div className="my-3"><ScoreRing value={r.score} size={70} label={r.basis === "pre-date" ? "pre-date" : "mutual fit"} /></div>
                    {r.mutualSecondDate && <div className="mb-2 text-xs text-pink-200">💞 both want a 2nd date</div>}
                    <div className="line-clamp-3 text-xs text-white/60">{r.reason}</div>
                  </Link>
                ))}
              </div>
            )}
            <div className="glass divide-y divide-white/5 p-2">
              {rankings.slice(3).map((r, i) => (
                <Link key={r.id} href={r.dateId ? `/date/${r.dateId}` : `/p/${r.id}`} className="flex items-center gap-3 rounded-2xl p-3 transition hover:bg-white/5">
                  <span className="w-6 text-right font-mono text-white/30">{i + 4}</span>
                  <Avatar src={r.photo} name={r.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{r.name} {r.dateId && <span className="ml-1 rounded-full bg-pink-500/20 px-2 text-[10px] text-pink-200">dated</span>}</div>
                    <div className="truncate text-xs text-white/45">{r.reason}</div>
                  </div>
                  <div className="w-28">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="grow h-1.5 rounded-full bg-gradient-to-r from-pink-500 to-orange-300" style={{ width: `${r.score}%` }} /></div>
                  </div>
                  <span className="w-8 text-right font-mono text-sm">{r.score}</span>
                </Link>
              ))}
            </div>
            {!rankings.length && <p className="text-white/50">Rankings appear once there are compatible people in the pool.</p>}
          </section>
        </>
      )}
    </div>
  );
}

const Flags = ({ title, items, cls }: { title: string; items: string[]; cls: string }) => (
  <div>
    <div className="mb-1.5 text-xs uppercase tracking-widest text-white/45">{title}</div>
    <div className="flex flex-wrap gap-1.5">{items?.map((x, i) => <span key={i} className={`rounded-full px-2.5 py-1 text-xs ${cls}`}>{x}</span>)}</div>
  </div>
);
