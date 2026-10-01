"use client";
import { useState } from "react";
import { PersonCard } from "./PersonCard";

type P = { id: string; name: string; photo?: string; oneLiner?: string; gender?: string; status: string; tags?: string[] };

export function PoolGrid({ people }: { people: P[] }) {
  const [filter, setFilter] = useState<"all" | "woman" | "man">("all");
  const shown = people.filter((p) => filter === "all" || p.gender === filter);
  return (
    <>
      <div className="mb-5 flex gap-2">
        {([["all", `Everyone · ${people.length}`], ["woman", `Women · ${people.filter((p) => p.gender === "woman").length}`], ["man", `Men · ${people.filter((p) => p.gender === "man").length}`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-4 py-1.5 text-sm transition ${filter === k ? "bg-gradient-to-r from-pink-500 to-orange-400 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>{l}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((p, i) => <PersonCard key={p.id} {...p} delay={i * 40} />)}
      </div>
    </>
  );
}
