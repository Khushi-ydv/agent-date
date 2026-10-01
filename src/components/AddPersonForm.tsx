"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AddPersonForm() {
  const router = useRouter();
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/people", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ linkedin, instagram }) });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Something went wrong");
      setBusy(false);
      return;
    }
    router.push(`/p/${body.id}`);
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <div className="text-sm font-semibold text-white/80">Create an agent for a real person</div>
      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wide text-white/50">LinkedIn profile</span>
        <input required value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://www.linkedin.com/in/username" className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 outline-none focus:border-rose-400" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wide text-white/50">Instagram profile (public)</span>
        <input required value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://www.instagram.com/username" className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 outline-none focus:border-rose-400" />
      </label>
      {error && <div className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</div>}
      <button className="btn w-full" disabled={busy}>{busy ? "Creating agent…" : "Create agent & read profile →"}</button>
      <p className="text-xs text-white/40">The agent reads only these two public pages. Then you can send it on dates with the agents in the pool.</p>
    </form>
  );
}
