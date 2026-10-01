"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import type { Analysis, Debrief, Evidenced, LogEntry, RankingRow } from "@/lib/types";

interface Data {
  person: {
    id: string;
    status: string;
    datingStatus?: string;
    error?: string;
    photo?: string;
    linkedinUrl: string;
    instagramUrl: string;
    log: LogEntry[];
    analysis?: Analysis;
    shortlist?: { id: string; interest: number; reason: string }[];
    sources: {
      linkedin?: { name?: string; headline?: string; location?: string; method: string; experience: number; posts: number };
      instagram?: { username: string; bio?: string; followers?: number; method: string; posts: number; images: string[] };
    };
  };
  running: { ingest: boolean; dating: boolean };
  dates: { id: string; with: string; withName?: string; withPhoto?: string; initiatedByMe: boolean; status: string; venue?: { place: string; activity: string; why: string }; messages: number; myDebrief?: Debrief; theirDebrief?: Debrief }[];
  rankings: RankingRow[];
}

const SRC: Record<string, string> = { linkedin: "bg-sky-500/20 text-sky-300", instagram: "bg-fuchsia-500/20 text-fuchsia-300", both: "bg-amber-500/20 text-amber-300" };

function EvidenceList({ title, icon, items }: { title: string; icon: string; items: Evidenced[] }) {
  return (
    <div className="card p-5">
      <h3 className="mb-3 font-semibold">{icon} {title}</h3>
      <ul className="space-y-3">
        {items.map((x, i) => (
          <li key={i} className="pop" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{x.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${SRC[x.source] ?? SRC.both}`}>{x.source}</span>
            </div>
            <p className="text-sm text-white/60">{x.detail}</p>
            <div className="mt-1 h-1 rounded bg-white/10"><div className="h-1 rounded bg-rose-400/70" style={{ width: `${Math.round((x.confidence ?? 0.5) * 100)}%` }} /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProfileView({ id }: { id: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sending, setSending] = useState(false);

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

  if (notFound) return <div className="card p-8">No such person. <Link className="text-rose-300 underline" href="/">Back to the pool</Link></div>;
  if (!data) return <div className="animate-pulse text-white/50">Loading agent…</div>;

  const { person: p, dates, rankings } = data;
  const a = p.analysis;
  const name = a?.name ?? p.sources.linkedin?.name ?? p.id;

  async function act(body: object) {
    setSending(true);
    await fetch(`/api/people/${id}/date`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setTimeout(() => setSending(false), 1500);
    load();
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="card flex flex-col gap-5 p-6 md:flex-row md:items-center">
        <Avatar src={p.photo} name={name} size={96} />
        <div className="flex-1 space-y-2">
          <h1 className="text-3xl font-bold">{name}</h1>
          {a && <p className="text-lg text-white/80">{a.oneLiner}</p>}
          <div className="flex flex-wrap gap-2 text-sm">
            <a href={p.linkedinUrl} target="_blank" className="chip hover:bg-white/10">in · LinkedIn ↗</a>
            <a href={p.instagramUrl} target="_blank" className="chip hover:bg-white/10">◎ Instagram ↗</a>
            {a?.location && <span className="chip">📍 {a.location}</span>}
            {a?.career && <span className="chip">💼 {a.career.role}</span>}
          </div>
        </div>
        <div className="text-right text-sm">
          <StatusPill status={p.status} />
        </div>
      </section>

      {/* Reading */}
      <section className="grid gap-4 md:grid-cols-[1fr_1.3fr]">
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">🔎 How the agent read {name.split(" ")[0]}</h2>
          <ol className="space-y-2 border-l border-white/10 pl-4 text-sm">
            {p.log.filter((l) => !/^(Agent is reviewing|Asked out|All dates|Dating failed)/.test(l.step)).map((l, i) => (
              <li key={i} className="pop">
                <div className="font-medium">{l.step}</div>
                {l.detail && <div className="text-white/50">{l.detail}</div>}
              </li>
            ))}
            {["queued", "scraping", "analyzing"].includes(p.status) && <li className="animate-pulse text-rose-300">working…</li>}
          </ol>
          {p.status === "error" && (
            <div className="mt-4 space-y-2">
              <div className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{p.error}</div>
              <button className="btn-ghost" onClick={() => act({ retry: true })} disabled={sending}>Retry</button>
            </div>
          )}
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">🧠 Agent&apos;s reading notes</h2>
          {a ? (
            <ul className="space-y-2 text-sm text-white/80">
              {a.readingNotes?.map((n, i) => <li key={i} className="pop flex gap-2" style={{ animationDelay: `${i * 80}ms` }}><span className="text-rose-400">›</span>{n}</li>)}
            </ul>
          ) : (
            <p className="text-sm text-white/50">Notes appear once the agent finishes reading both profiles.</p>
          )}
          {!!p.sources.instagram?.images.length && (
            <div className="mt-4 grid grid-cols-6 gap-1">
              {p.sources.instagram.images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={`/api/img?u=${encodeURIComponent(src)}`} alt="" className="aspect-square w-full rounded object-cover opacity-80" />
              ))}
            </div>
          )}
        </div>
      </section>

      {a && (
        <>
          <section className="card p-6">
            <h2 className="mb-2 text-xl font-semibold">Profile analysis</h2>
            <p className="text-white/80">{a.summary}</p>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
              <Info k="Career" v={`${a.career.role} — ${a.career.stage}. ${a.career.ambition}`} />
              <Info k="Looking for" v={a.lookingFor} />
              <Info k="Ideal first date" v={a.idealFirstDate} />
              <Info k="Communication style" v={a.communicationStyle} />
              <Info k="Love language (inferred)" v={a.loveLanguage} />
              <Info k="How the agent will sound" v={a.agentVoice} />
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <EvidenceList title="Needs" icon="💗" items={a.needs} />
            <EvidenceList title="Hobbies" icon="🎯" items={a.hobbies} />
            <EvidenceList title="Interests" icon="✨" items={a.interests} />
            <EvidenceList title="Values" icon="🧭" items={a.values} />
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="card p-5">
              <h3 className="mb-3 font-semibold">Personality (Big Five)</h3>
              {a.personality.map((t) => (
                <div key={t.trait} className="mb-3" title={t.note}>
                  <div className="flex justify-between text-sm"><span>{t.trait}</span><span className="text-white/50">{t.score}</span></div>
                  <div className="h-2 rounded bg-white/10"><div className="h-2 rounded bg-gradient-to-r from-rose-500 to-violet-400" style={{ width: `${t.score}%` }} /></div>
                  <div className="text-xs text-white/40">{t.note}</div>
                </div>
              ))}
            </div>
            <div className="card p-5">
              <h3 className="mb-3 font-semibold">Lifestyle</h3>
              <dl className="space-y-2 text-sm">
                {a.lifestyle.map((l) => <div key={l.label}><dt className="text-white/50">{l.label}</dt><dd>{l.value}</dd></div>)}
              </dl>
            </div>
            <div className="card space-y-4 p-5 text-sm">
              <ListBlock title="✅ Green flags they'd love" items={a.greenFlags} />
              <ListBlock title="⚠️ Watch-outs" items={a.watchOuts} />
              <ListBlock title="⛔ Dealbreakers" items={a.dealbreakers} />
              <ListBlock title="💬 Conversation hooks" items={a.conversationHooks} />
            </div>
          </section>

          {/* Dating */}
          <section className="card p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">💌 Dates</h2>
                <p className="text-sm text-white/50">The agent reviews the pool, asks out its best matches, and goes on live first dates with their agents.</p>
              </div>
              <button className="btn" onClick={() => act({})} disabled={sending || data.running.dating}>
                {data.running.dating ? (p.datingStatus === "choosing" ? "Reviewing the pool…" : "On dates…") : dates.length ? "Go on more dates" : "Send my agent on dates →"}
              </button>
            </div>
            {!dates.length && !data.running.dating && <p className="text-white/50">No dates yet.</p>}
            {data.running.dating && p.datingStatus === "choosing" && <p className="animate-pulse text-rose-300">Agent is reading every candidate&apos;s card and deciding who to ask out…</p>}
            <div className="grid gap-3 md:grid-cols-2">
              {dates.map((d) => (
                <Link key={d.id} href={`/date/${d.id}`} className="pop rounded-xl border border-white/10 bg-black/20 p-4 transition hover:border-rose-400/50">
                  <div className="flex items-center gap-3">
                    <Avatar src={d.withPhoto} name={d.withName ?? d.with} size={40} />
                    <div className="flex-1">
                      <div className="font-semibold">{d.withName ?? d.with}</div>
                      <div className="text-xs text-white/50">{d.initiatedByMe ? "Your agent asked them out" : "Their agent asked you out"} · {d.venue?.place ?? "planning…"}</div>
                    </div>
                    <DateStatus d={d} />
                  </div>
                  {d.myDebrief && <p className="mt-3 text-sm text-white/70">“{d.myDebrief.reportToHuman}”</p>}
                </Link>
              ))}
            </div>
          </section>

          {/* Rankings */}
          <section className="card p-6">
            <h2 className="mb-1 text-xl font-semibold">🏆 Who fits {name.split(" ")[0]} best</h2>
            <p className="mb-4 text-sm text-white/50">Dated matches score from both agents&apos; debriefs (mutual). Others are ranked by pre-date interest.</p>
            <ol className="space-y-2">
              {rankings.map((r, i) => (
                <li key={r.id} className="flex items-center gap-3 rounded-xl bg-black/20 p-3">
                  <span className="w-6 text-right font-mono text-white/40">{i + 1}</span>
                  <Avatar src={r.photo} name={r.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/p/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                      {r.basis === "mutual-date" && <span className="rounded-full bg-rose-500/20 px-2 text-[10px] uppercase text-rose-300">dated</span>}
                      {r.mutualSecondDate && <span className="rounded-full bg-emerald-500/20 px-2 text-[10px] uppercase text-emerald-300">both want a 2nd date</span>}
                    </div>
                    <div className="truncate text-xs text-white/50">{r.reason}</div>
                  </div>
                  {r.dateId && <Link href={`/date/${r.dateId}`} className="btn-ghost hidden md:inline-flex">transcript</Link>}
                  <div className="w-24">
                    <div className="text-right font-mono text-sm">{r.score}</div>
                    <div className="h-1.5 rounded bg-white/10"><div className="h-1.5 rounded bg-rose-400" style={{ width: `${r.score}%` }} /></div>
                  </div>
                </li>
              ))}
            </ol>
            {!rankings.length && <p className="text-white/50">Rankings appear once there are other people in the pool.</p>}
          </section>
        </>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = { ready: "✓ analyzed", error: "error", queued: "queued…", scraping: "reading sources…", analyzing: "analyzing…" };
  return <span className={`chip ${status === "ready" ? "text-emerald-300" : status === "error" ? "text-red-300" : "animate-pulse text-rose-300"}`}>{map[status] ?? status}</span>;
}

function DateStatus({ d }: { d: Data["dates"][number] }) {
  if (d.status === "done" && d.myDebrief && d.theirDebrief)
    return <div className="text-right"><div className="font-mono text-lg">{Math.round((d.myDebrief.overall + d.theirDebrief.overall) / 2)}</div><div className="text-[10px] uppercase text-white/40">{d.myDebrief.secondDate && d.theirDebrief.secondDate ? "💞 mutual" : "fit"}</div></div>;
  if (d.status === "error") return <span className="text-xs text-red-300">failed</span>;
  return <span className="animate-pulse text-xs text-rose-300">{d.status === "live" ? `live · ${d.messages} msgs` : d.status}</span>;
}

const Info = ({ k, v }: { k: string; v: string }) => (
  <div className="rounded-xl bg-black/20 p-3"><div className="text-xs uppercase tracking-wide text-white/40">{k}</div><div className="text-white/85">{v}</div></div>
);

const ListBlock = ({ title, items }: { title: string; items: string[] }) => (
  <div><div className="mb-1 font-semibold">{title}</div><ul className="list-inside list-disc text-white/70">{items?.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
);
