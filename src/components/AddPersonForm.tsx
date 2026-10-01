"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart } from "./FloatingHearts";

function Toggle<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex rounded-full bg-black/30 p-1">
      {options.map(([v, label]) => (
        <button type="button" key={v} onClick={() => onChange(v)} className={`flex-1 rounded-full px-3 py-1.5 text-sm transition ${value === v ? "bg-gradient-to-r from-pink-500 to-orange-400 text-white shadow" : "text-white/60 hover:text-white"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function AddPersonForm() {
  const router = useRouter();
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");
  const [gender, setGender] = useState<"auto" | "man" | "woman">("auto");
  const [seeking, setSeeking] = useState<"auto" | "women" | "men" | "everyone">("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedin, instagram, gender: gender === "auto" ? undefined : gender, seeking: seeking === "auto" ? undefined : seeking }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Something went wrong");
      setBusy(false);
      return;
    }
    router.push(`/p/${body.id}`);
  }

  const input = "w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition placeholder:text-white/30 focus:border-pink-400 focus:bg-black/40";
  return (
    <form onSubmit={submit} className="glass space-y-3 p-6">
      <div className="flex items-center gap-2 font-display text-2xl italic">
        <Heart className="beat text-pink-400" /> Create your agent
      </div>
      <input required value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="in  linkedin.com/in/username" className={input} />
      <input required value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="◎  instagram.com/username (public)" className={input} />
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-xs text-white/50">
        <span>I am</span>
        <Toggle value={gender} onChange={setGender} options={[["auto", "✨ Auto"], ["woman", "Woman"], ["man", "Man"]]} />
        <span>Looking for</span>
        <Toggle value={seeking} onChange={setSeeking} options={[["auto", "Opposite"], ["men", "Men"], ["women", "Women"], ["everyone", "All"]]} />
      </div>
      {error && <div className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</div>}
      <button className="btn w-full" disabled={busy}>
        {busy ? "Waking up your agent…" : <>Find my match <Heart size={16} /></>}
      </button>
      <p className="text-center text-xs text-white/40">Your agent reads only these two public pages.</p>
    </form>
  );
}
