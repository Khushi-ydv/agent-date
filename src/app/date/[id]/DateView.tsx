"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import type { DateRecord, Debrief } from "@/lib/types";

type Who = { id: string; name: string; photo?: string; oneLiner?: string };

export function DateView({ id }: { id: string }) {
  const [date, setDate] = useState<DateRecord | null>(null);
  const [people, setPeople] = useState<Record<string, Who>>({});
  const [showThoughts, setShowThoughts] = useState(true);
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
  const live = date && !["done", "error"].includes(date.status);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(load, 1200);
    return () => clearInterval(t);
  }, [live, load]);
  const count = date?.messages.length ?? 0;
  useEffect(() => {
    if (live) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [count, live]);

  if (!date) return <div className="animate-pulse text-white/50">Loading date…</div>;
  const A = people[date.a];
  const B = people[date.b];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="card p-6 text-center">
        <div className="mb-3 flex items-center justify-center gap-4">
          <Link href={`/p/${A.id}`} className="flex flex-col items-center gap-1"><Avatar src={A.photo} name={A.name} size={64} /><span className="text-sm font-medium">{A.name}</span></Link>
          <span className="text-3xl text-rose-400">♥</span>
          <Link href={`/p/${B.id}`} className="flex flex-col items-center gap-1"><Avatar src={B.photo} name={B.name} size={64} /><span className="text-sm font-medium">{B.name}</span></Link>
        </div>
        <div className="text-xs uppercase tracking-widest text-white/40">{A.name.split(" ")[0]}&apos;s agent asked {B.name.split(" ")[0]}&apos;s agent out</div>
        {date.venue ? (
          <div className="mt-3">
            <div className="text-xl font-semibold">📍 {date.venue.place}</div>
            <div className="text-white/70">{date.venue.activity}</div>
            <div className="mt-1 text-sm text-white/40">{date.venue.why}</div>
          </div>
        ) : (
          <div className="mt-3 animate-pulse text-rose-300">Agents are planning the date…</div>
        )}
      </section>

      <div className="flex items-center justify-between text-sm">
        <span className={live ? "animate-pulse text-rose-300" : "text-white/50"}>{live ? `● LIVE — ${date.status}` : date.status === "error" ? `Date failed: ${date.error}` : "Date finished"}</span>
        <label className="flex cursor-pointer items-center gap-2 text-white/60">
          <input type="checkbox" checked={showThoughts} onChange={(e) => setShowThoughts(e.target.checked)} /> show agents&apos; private notes
        </label>
      </div>

      <section className="space-y-4">
        {date.messages.map((m, i) => {
          const mine = m.from === date.a;
          const who = people[m.from];
          return (
            <div key={i} className={`pop flex gap-3 ${mine ? "" : "flex-row-reverse text-right"}`}>
              <Avatar src={who.photo} name={who.name} size={36} />
              <div className={`max-w-[80%] space-y-1 ${mine ? "" : "items-end"}`}>
                <div className="text-xs text-white/40">{who.name}&apos;s agent</div>
                <div className={`rounded-2xl px-4 py-3 text-left ${mine ? "rounded-tl-sm bg-white/10" : "rounded-tr-sm bg-rose-500/25"}`}>{m.say}</div>
                {showThoughts && m.thought && <div className="text-left text-xs italic text-amber-200/70">🤫 {m.thought}</div>}
              </div>
            </div>
          );
        })}
        {date.status === "live" && <div className="animate-pulse text-center text-sm text-white/40">typing…</div>}
        <div ref={bottom} />
      </section>

      {(date.status === "debrief" || date.status === "done") && (
        <section className="grid gap-4 md:grid-cols-2">
          {[A, B].map((p) => (
            <DebriefCard key={p.id} who={p} d={date.debriefs[p.id]} />
          ))}
        </section>
      )}
    </div>
  );
}

function DebriefCard({ who, d }: { who: Who; d?: Debrief }) {
  if (!d) return <div className="card animate-pulse p-5 text-white/50">{who.name.split(" ")[0]}&apos;s agent is writing its debrief…</div>;
  const bars: [string, number][] = [["Chemistry", d.chemistry], ["Values", d.valuesFit], ["Lifestyle", d.lifestyleFit], ["Goals", d.goalsFit]];
  return (
    <div className="card pop space-y-3 p-5">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{who.name.split(" ")[0]}&apos;s agent debrief</div>
        <div className="text-right"><div className="font-mono text-2xl">{d.overall}</div><div className="text-[10px] uppercase text-white/40">overall</div></div>
      </div>
      {bars.map(([k, v]) => (
        <div key={k}>
          <div className="flex justify-between text-xs"><span>{k}</span><span>{v}/10</span></div>
          <div className="h-1.5 rounded bg-white/10"><div className="h-1.5 rounded bg-rose-400" style={{ width: `${v * 10}%` }} /></div>
        </div>
      ))}
      <div className={`chip ${d.secondDate ? "text-emerald-300" : "text-white/60"}`}>{d.secondDate ? "💞 Wants a second date" : "🙅 No second date"}</div>
      <p className="text-sm"><span className="text-white/40">Highlight: </span>{d.highlight}</p>
      <p className="text-sm"><span className="text-white/40">Concern: </span>{d.concern}</p>
      <p className="rounded-xl bg-black/30 p-3 text-sm italic">📱 To {who.name.split(" ")[0]}: “{d.reportToHuman}”</p>
    </div>
  );
}
