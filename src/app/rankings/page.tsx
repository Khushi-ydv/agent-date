import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { rankingsFor } from "@/lib/pipeline";
import { listPeople } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Rankings() {
  const people = listPeople().filter((p) => p.status === "ready");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">🏆 Rankings</h1>
        <p className="text-white/60">For every person: who fits them best, after their agents actually dated. Score = average of both agents&apos; post-date verdicts (+5 if both want a second date). Click a person for the full list of {Math.max(0, people.length - 1)}.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {people.map((p) => {
          const top = rankingsFor(p.id).slice(0, 3);
          return (
            <div key={p.id} className="card p-4">
              <Link href={`/p/${p.id}`} className="mb-3 flex items-center gap-3">
                <Avatar src={p.photo} name={p.analysis!.name} size={44} />
                <div className="min-w-0">
                  <div className="font-semibold hover:underline">{p.analysis!.name}</div>
                  <div className="truncate text-xs text-white/50">{p.analysis!.oneLiner}</div>
                </div>
              </Link>
              <ol className="space-y-1.5">
                {top.map((r, i) => (
                  <li key={r.id} className="flex items-center gap-2 rounded-lg bg-black/20 px-2 py-1.5 text-sm">
                    <span className="w-4 font-mono text-white/40">{i + 1}</span>
                    <Avatar src={r.photo} name={r.name} size={24} />
                    <span className="flex-1 truncate">{r.name}</span>
                    {r.mutualSecondDate && <span title="both agents want a second date">💞</span>}
                    {r.dateId ? <Link href={`/date/${r.dateId}`} className="text-xs text-rose-300 hover:underline">date</Link> : <span className="text-xs text-white/30">pre-date</span>}
                    <span className="w-8 text-right font-mono">{r.score}</span>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </div>
  );
}
