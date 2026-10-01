"use client";
import Link from "next/link";
import { useState } from "react";
import { Heart } from "./FloatingHearts";
import { imgSrc } from "@/lib/img";

export function PersonCard({ id, name, photo, oneLiner, gender, tags, status, delay = 0 }: { id: string; name: string; photo?: string; oneLiner?: string; gender?: string; tags?: string[]; status: string; delay?: number }) {
  const [broken, setBroken] = useState(false);
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <Link href={`/p/${id}`} className="pop lift group relative block aspect-[3/4] overflow-hidden rounded-3xl border border-white/10" style={{ animationDelay: `${delay}ms` }}>
      {photo && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgSrc(photo)} alt={name} onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-6xl font-bold" style={{ background: `linear-gradient(160deg, hsl(${hue} 60% 45%), hsl(${(hue + 60) % 360} 60% 25%))` }}>{name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#14061c] via-[#14061c]/40 to-transparent" />
      <div className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur transition group-hover:scale-110 group-hover:bg-pink-500 group-hover:text-white">
        <Heart size={18} />
      </div>
      {gender && gender !== "unknown" && <div className="absolute left-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-xs backdrop-blur">{gender === "woman" ? "♀ Woman" : "♂ Man"}</div>}
      <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-4">
        <div className="font-display text-xl font-semibold leading-tight">{name}</div>
        <div className="line-clamp-2 text-xs text-white/70">{oneLiner ?? (status === "error" ? "⚠ couldn't read profile" : `agent is ${status}…`)}</div>
        {!!tags?.length && (
          <div className="flex flex-wrap gap-1 pt-1">
            {tags.slice(0, 3).map((t) => <span key={t} className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] backdrop-blur">{t}</span>)}
          </div>
        )}
      </div>
    </Link>
  );
}
