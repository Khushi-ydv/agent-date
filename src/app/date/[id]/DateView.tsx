"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Heart } from "@/components/FloatingHearts";
import { Icon3D } from "@/components/Love3D";
import { DateStage } from "@/components/DateStage";
import { MatchBurst, ScoreRing } from "@/components/MatchBurst";
import type { SceneKey } from "@/components/ScenePicker";
import type { DateRecord, Debrief } from "@/lib/types";

type Who = { id: string; name: string; photo?: string; oneLiner?: string; gender?: string };

export function DateView({ id }: { id: string }) {
  const [date, setDate] = useState<DateRecord | null>(null);
  const [people, setPeople] = useState<Record<string, Who>>({});
  const [showThoughts, setShowThoughts] = useState(true);
  const [celebrated, setCelebrated] = useState(false);
  const [burst, setBurst] = useState(false);
  const wasLive = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/dates/${id}`, { cache: "no-store" });
    if (!res.ok) return;
    const body = await res.json();
    setDate(body.date);
    setPeople(body.people);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);
  const live = !!date && !["done", "error"].includes(date.status);
  if (live) wasLive.current = true;
  useEffect(() => {
    if (!live) return;
    const t = setInterval(load, 1200);
    return () => clearInterval(t);
  }, [live, load]);
  const count = date?.messages.length ?? 0;
  useEffect(() => {
    if (live) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [count, live]);

  const da = date?.debriefs[date.a];
  const db = date?.debriefs[date.b];
  const mutual = !!(date?.status === "done" && da?.secondDate && db?.secondDate);
  const score = da && db ? Math.round((da.overall + db.overall) / 2) : 0;
  // Celebrate when a mutual match is revealed (live), or once when opening a finished mutual date.
  useEffect(() => {
    if (mutual && !celebrated) {
      setCelebrated(true);
      setBurst(true);
    }
  }, [mutual, celebrated]);

  if (!date || !people[date.a]) return <div className="flex justify-center py-32"><Heart size={48} className="beat text-pink-500" /></div>;
  const A = people[date.a];
  const B = people[date.b];
  const nextSpeaker = date.messages.length % 2 === 0 ? A : B;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {burst && <MatchBurst a={A} b={B} score={score} onClose={() => setBurst(false)} />}

      <div className="flex flex-wrap items-center justify-center gap-3 text-center">
        <Link href={`/p/${A.id}`} className="font-display text-2xl italic hover:underline">{A.name}</Link>
        <Heart size={22} className="beat text-pink-500" />
        <Link href={`/p/${B.id}`} className="font-display text-2xl italic hover:underline">{B.name}</Link>
        <span className="w-full text-xs uppercase tracking-[0.25em] text-pink-200/70">{A.name.split(" ")[0]}&apos;s agent asked {B.name.split(" ")[0]}&apos;s agent out{date.venue?.why ? ` · ${date.venue.why}` : ""}</span>
      </div>
      <DateStage scene={(date.scene ?? date.venue?.scene) as SceneKey | undefined} venue={date.venue} a={A} b={B} messages={date.messages} live={live} />

      <div className="flex items-center justify-between text-sm">
        <span className={live ? "flex items-center gap-2 text-pink-300" : "text-white/50"}>
          {live && <span className="h-2 w-2 animate-ping rounded-full bg-pink-500" />}
          {live ? `LIVE — ${date.status === "debrief" ? "agents are reflecting" : date.status}` : date.status === "error" ? `Date failed: ${date.error}` : "The date is over"}
        </span>
        <label className="flex cursor-pointer items-center gap-2 text-white/60">
          <input type="checkbox" className="accent-pink-500" checked={showThoughts} onChange={(e) => setShowThoughts(e.target.checked)} /> 🤫 agents&apos; private notes
        </label>
      </div>

      <section className="space-y-5">
        {date.messages.map((m, i) => {
          const left = m.from === date.a;
          const who = people[m.from];
          return (
            <div key={i} className={`pop flex items-end gap-3 ${left ? "" : "flex-row-reverse"}`}>
              <Avatar src={who.photo} name={who.name} size={38} />
              <div className={`max-w-[78%] space-y-1 ${left ? "" : "text-right"}`}>
                <div className="text-[11px] text-white/40">{who.name.split(" ")[0]}&apos;s agent</div>
                <div className={`rounded-3xl px-4 py-3 text-left leading-relaxed shadow-lg ${left ? "rounded-bl-md bg-white/10" : "rounded-br-md bg-gradient-to-br from-pink-500/70 to-orange-400/60"}`}>{m.say}</div>
                {showThoughts && m.thought && <div className="text-left text-xs italic text-amber-200/70">🤫 {m.thought}</div>}
              </div>
            </div>
          );
        })}
        {date.status === "live" && (
          <div className={`flex items-center gap-3 ${nextSpeaker.id === date.a ? "" : "flex-row-reverse"}`}>
            <Avatar src={nextSpeaker.photo} name={nextSpeaker.name} size={30} />
            <div className="rounded-full bg-white/10 px-4 py-2 text-pink-200"><span className="dot">●</span> <span className="dot" style={{ animationDelay: ".2s" }}>●</span> <span className="dot" style={{ animationDelay: ".4s" }}>●</span></div>
          </div>
        )}
        <div ref={bottom} />
      </section>

      {(date.status === "debrief" || date.status === "done") && (
        <>
          {date.status === "done" && (
            <div className={`glass pop flex flex-col items-center gap-2 p-6 text-center ${mutual ? "border-pink-400/50" : ""}`}>
              <ScoreRing value={score} size={96} label="mutual fit" />
              {mutual && <div className="flex gap-2"><Icon3D name="love-letter" size={56} /><Icon3D name="calendar" size={52} delay={120} /><Icon3D name="arrow-heart" size={60} delay={240} /></div>}
              <div className="font-display text-3xl italic">{mutual ? <span className="text-love">It&apos;s a match 💞</span> : da?.secondDate || db?.secondDate ? "One-sided spark" : "Not this time"}</div>
              {mutual && <button className="btn-ghost" onClick={() => setBurst(true)}>Replay the moment ✨</button>}
            </div>
          )}
          <section className="grid gap-4 md:grid-cols-2">
            {[A, B].map((p) => <DebriefCard key={p.id} who={p} d={date.debriefs[p.id]} />)}
          </section>
        </>
      )}
    </div>
  );
}

function DebriefCard({ who, d }: { who: Who; d?: Debrief }) {
  const first = who.name.split(" ")[0];
  if (!d) return <div className="glass animate-pulse p-5 text-white/50">{first}&apos;s agent is writing its debrief…</div>;
  const bars: [string, string, number][] = [["⚡", "Chemistry", d.chemistry], ["🧭", "Values", d.valuesFit], ["🏡", "Lifestyle", d.lifestyleFit], ["🎯", "Goals", d.goalsFit]];
  return (
    <div className="glass pop space-y-3 p-5">
      <div className="flex items-center gap-3">
        <Avatar src={who.photo} name={who.name} size={40} />
        <div className="flex-1 font-display text-lg italic">{first}&apos;s agent</div>
        <ScoreRing value={d.overall} size={52} />
      </div>
      {bars.map(([icon, k, v]) => (
        <div key={k}>
          <div className="flex justify-between text-xs"><span>{icon} {k}</span><span>{v}/10</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="grow h-1.5 rounded-full bg-gradient-to-r from-pink-500 to-orange-300" style={{ width: `${v * 10}%` }} /></div>
        </div>
      ))}
      <div className={`chip ${d.secondDate ? "border-pink-400/40 text-pink-200" : "text-white/60"}`}>{d.secondDate ? "💞 Wants a second date" : "🙅 No second date"}</div>
      <p className="text-sm"><span className="text-white/40">✨ Best moment: </span>{d.highlight}</p>
      <p className="text-sm"><span className="text-white/40">⚠️ Concern: </span>{d.concern}</p>
      <div className="rounded-2xl rounded-tl-sm bg-gradient-to-br from-pink-500/20 to-violet-500/20 p-3 text-sm">
        <div className="mb-1 text-[10px] uppercase tracking-widest text-white/40">📱 Text to {first}</div>
        {d.reportToHuman}
      </div>
    </div>
  );
}
