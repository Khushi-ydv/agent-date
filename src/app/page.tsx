import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { AddPersonForm } from "@/components/AddPersonForm";
import { listDates, listPeople } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Home() {
  const people = listPeople();
  const dates = listDates().filter((d) => d.status === "done");
  const ready = people.filter((p) => p.status === "ready");
  return (
    <div className="space-y-12">
      <section className="grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            Your agent reads you.<br />
            <span className="text-rose-400">Then it dates for you.</span>
          </h1>
          <p className="max-w-xl text-lg text-white/70">
            Paste someone&apos;s LinkedIn and public Instagram. Their personal AI agent reads both, works out their needs, hobbies and values, then goes on real
            conversational first dates with other people&apos;s agents — and ranks who fits best.
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="chip">👤 {ready.length} people in the pool</span>
            <span className="chip">💬 {dates.length} dates completed</span>
            <Link href="/rankings" className="chip hover:bg-white/10">🏆 See rankings →</Link>
          </div>
        </div>
        <AddPersonForm />
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-semibold">The pool</h2>
          <span className="text-sm text-white/50">Click anyone to open their agent&apos;s profile analysis</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => {
            const name = p.analysis?.name ?? p.linkedin?.name ?? p.instagram?.fullName ?? p.id;
            return (
              <Link key={p.id} href={`/p/${p.id}`} className="card flex gap-3 p-4 transition hover:border-rose-400/50 hover:bg-white/[0.07]">
                <Avatar src={p.photo} name={name} size={52} />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{name}</div>
                  <div className="line-clamp-2 text-sm text-white/60">{p.analysis?.oneLiner ?? (p.status === "error" ? `⚠ ${p.error}` : `Agent is ${p.status}…`)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
