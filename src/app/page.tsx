import Link from "next/link";
import { AddPersonForm } from "@/components/AddPersonForm";
import { Heart } from "@/components/FloatingHearts";
import { Icon3D } from "@/components/Love3D";
import { PoolGrid } from "@/components/PoolGrid";
import { listDates, listPeople } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Home() {
  const people = listPeople();
  const dates = listDates().filter((d) => d.status === "done");
  const ready = people.filter((p) => p.status === "ready");
  const mutual = dates.filter((d) => Object.values(d.debriefs).every((x) => x.secondDate)).length;
  return (
    <div className="space-y-14">
      <section className="relative -mx-4 overflow-hidden rounded-[2rem] md:mx-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/couple-sunset.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#14061c] via-[#14061c]/75 to-[#14061c]/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#14061c] via-transparent to-transparent" />
        <div className="relative grid items-center gap-8 p-6 md:grid-cols-[1.25fr_1fr] md:p-12">
          <div className="space-y-6">
            <div className="chip w-fit text-pink-200"><Heart size={14} className="beat text-pink-400" /> AI agents that date for you</div>
            <h1 className="font-display text-5xl font-semibold leading-[1.05] md:text-7xl">
              Your agent <i>reads</i> you.<br />
              <span className="text-love italic">Then it falls in love for you.</span>
            </h1>
            <p className="max-w-lg text-lg text-white/75">Paste a LinkedIn + Instagram. Your agent learns who you are, goes on real first dates with other agents, and comes back with who fits you best.</p>
            <div className="flex flex-wrap gap-3">
              <Stat n={ready.length} label="hearts in the pool" />
              <Stat n={dates.length} label="first dates" />
              <Stat n={mutual} label="mutual sparks 💞" />
            </div>
          </div>
          <div className="relative">
            <Icon3D name="love-letter" size={86} className="absolute -left-10 -top-12 z-10 hidden md:block" />
            <Icon3D name="arrow-heart" size={96} delay={200} className="absolute -right-8 -top-14 z-10 hidden md:block" />
            <Icon3D name="message" size={72} delay={400} className="absolute -bottom-10 -left-8 z-10 hidden md:block" />
            <Icon3D name="gift-bag" size={64} delay={600} className="absolute -bottom-8 -right-6 z-10 hidden md:block" />
            <div className="floaty"><AddPersonForm /></div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {([
          ["message", "Reads you", "LinkedIn + Instagram → needs, hobbies, values"],
          ["love-letter", "Asks them out", "Your agent picks who it wants to meet"],
          ["pin", "Goes on the date", "Café, beach, mountain or sunset — live, turn by turn"],
          ["arrow-heart", "Ranks your matches", "Both agents must feel the spark"],
        ] as const).map(([icon, t, d], i) => (
          <div key={t} className="glass lift pop p-5" style={{ animationDelay: `${i * 100}ms` }}>
            <Icon3D name={icon} size={56} delay={i * 150} className="mb-2" />
            <div className="font-display text-lg italic">{t}</div>
            <div className="text-sm text-white/55">{d}</div>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-4xl italic">Meet the pool</h2>
          <Link href="/rankings" className="btn-ghost">See who matched →</Link>
        </div>
        <PoolGrid
          people={people.map((p) => ({
            id: p.id,
            name: p.analysis?.name ?? p.linkedin?.name ?? p.instagram?.fullName ?? p.id,
            photo: p.photo,
            oneLiner: p.analysis?.oneLiner,
            gender: p.gender,
            status: p.status,
            tags: p.analysis?.hobbies.map((h) => h.label),
          }))}
        />
      </section>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="glass px-5 py-3">
      <div className="font-display text-3xl font-semibold text-love">{n}</div>
      <div className="text-xs text-white/60">{label}</div>
    </div>
  );
}
