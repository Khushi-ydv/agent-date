import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { getPerson, listDates } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Dates() {
  const dates = listDates().reverse();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-5xl italic">💬 Every date</h1>
        <p className="text-white/60">{dates.length} first dates between agents. Open any one to read the full conversation, the agents&apos; private notes and both debriefs.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {dates.map((d) => {
          const A = getPerson(d.a);
          const B = getPerson(d.b);
          const an = A?.analysis?.name ?? d.a;
          const bn = B?.analysis?.name ?? d.b;
          const da = d.debriefs[d.a];
          const db = d.debriefs[d.b];
          return (
            <Link key={d.id} href={`/date/${d.id}`} className="glass lift relative flex items-center gap-3 overflow-hidden p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/scenes/${d.scene ?? d.venue?.scene ?? "cafe"}.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
              <div className="relative flex -space-x-3"><Avatar src={A?.photo} name={an} size={40} /><Avatar src={B?.photo} name={bn} size={40} /></div>
              <div className="relative min-w-0 flex-1">
                <div className="truncate font-medium">{an} × {bn}</div>
                <div className="truncate text-xs text-white/50">📍 {d.venue?.place ?? "planning…"}</div>
              </div>
              {d.status === "done" && da && db ? (
                <div className="relative text-right"><div className="font-mono">{Math.round((da.overall + db.overall) / 2)}</div><div className="text-[10px] text-white/40">{da.secondDate && db.secondDate ? "💞 mutual" : `${da.secondDate ? "✓" : "✗"} / ${db.secondDate ? "✓" : "✗"}`}</div></div>
              ) : (
                <span className="relative animate-pulse text-xs text-pink-300">{d.status}</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
