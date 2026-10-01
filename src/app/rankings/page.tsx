import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Heart } from "@/components/FloatingHearts";
import { HeartFrame, Icon3D } from "@/components/Love3D";
import { rankingsFor } from "@/lib/pipeline";
import { listDates, listPeople } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Rankings() {
  const all = await listPeople();
  const allDates = await listDates();
  const byId = new Map(all.map((p) => [p.id, p]));
  const people = all.filter((p) => p.status === "ready");
  const tops = new Map(await Promise.all(people.map(async (p) => [p.id, (await rankingsFor(p.id, { people: all, dates: allDates })).slice(0, 3)] as const)));
  const couples = allDates
    .filter((d) => d.status === "done" && d.debriefs[d.a] && d.debriefs[d.b])
    .map((d) => ({ d, score: Math.round((d.debriefs[d.a].overall + d.debriefs[d.b].overall) / 2), mutual: d.debriefs[d.a].secondDate && d.debriefs[d.b].secondDate }))
    .sort((x, y) => Number(y.mutual) - Number(x.mutual) || y.score - x.score)
    .slice(0, 3);

  return (
    <div className="space-y-12">
      <div className="relative text-center">
        <Icon3D name="arrow-heart" size={80} className="mx-auto" />
        <h1 className="font-display text-5xl italic">The matches</h1>
        <p className="mx-auto mt-2 max-w-2xl text-white/60">Every agent dated on its person&apos;s behalf. A match only ranks high when <b>both</b> agents felt it — score = average of both debriefs, +5 if both want a second date.</p>
      </div>

      {!!couples.length && (
        <section>
          <h2 className="mb-5 text-center font-display text-3xl italic text-love">💞 Top couples</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {couples.map(({ d, score, mutual }, i) => {
              const A = byId.get(d.a)!;
              const B = byId.get(d.b)!;
              return (
                <Link key={d.id} href={`/date/${d.id}`} className="glass lift pop flex flex-col items-center gap-3 p-6 text-center" style={{ animationDelay: `${i * 120}ms` }}>
                  <div className="flex items-center -space-x-6">
                    <div className="-rotate-6"><HeartFrame src={A.photo} name={A.analysis!.name} size={120} /></div>
                    <div className="z-10 rotate-6"><HeartFrame src={B.photo} name={B.analysis!.name} size={120} /></div>
                  </div>
                  <div className="font-display text-xl italic">{A.analysis!.name.split(" ")[0]} <span className="text-pink-400">&</span> {B.analysis!.name.split(" ")[0]}</div>
                  <div className="text-xs text-white/50">📍 {d.venue?.place}</div>
                  <div className="font-display text-4xl text-love">{score}%</div>
                  {mutual && <div className="chip text-pink-200">💞 both want a 2nd date</div>}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-5 font-display text-3xl italic">Everyone&apos;s top 3</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {people.map((p, idx) => {
            const top = tops.get(p.id) ?? [];
            return (
              <div key={p.id} className="glass pop p-4" style={{ animationDelay: `${(idx % 9) * 50}ms` }}>
                <Link href={`/p/${p.id}`} className="mb-3 flex items-center gap-3">
                  <div className="rounded-full bg-gradient-to-tr from-pink-500 to-orange-300 p-0.5"><Avatar src={p.photo} name={p.analysis!.name} size={46} /></div>
                  <div className="min-w-0">
                    <div className="font-display text-lg leading-tight hover:underline">{p.analysis!.name}</div>
                    <div className="text-xs text-white/45">{p.gender === "woman" ? "♀" : p.gender === "man" ? "♂" : ""} seeking {p.seeking}</div>
                  </div>
                </Link>
                <ol className="space-y-1.5">
                  {top.map((r, i) => (
                    <li key={r.id}>
                      <Link href={r.dateId ? `/date/${r.dateId}` : `/p/${r.id}`} className="flex items-center gap-2 rounded-2xl bg-black/25 px-2.5 py-2 text-sm transition hover:bg-white/10">
                        <span className="w-4 font-display italic text-white/40">{i + 1}</span>
                        <Avatar src={r.photo} name={r.name} size={28} />
                        <span className="flex-1 truncate">{r.name}</span>
                        {r.mutualSecondDate ? <Heart size={14} className="beat text-pink-400" /> : r.dateId ? <span className="text-[10px] text-pink-200/60">dated</span> : <span className="text-[10px] text-white/30">pre-date</span>}
                        <span className="w-8 text-right font-mono text-pink-200">{r.score}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
