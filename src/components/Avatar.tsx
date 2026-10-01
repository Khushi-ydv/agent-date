"use client";
import { useState } from "react";

export function Avatar({ src, name, size = 48 }: { src?: string; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  if (!src || broken)
    return (
      <div className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, background: `hsl(${hue} 55% 38%)`, fontSize: size / 2.6 }}>
        {initials}
      </div>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/img?u=${encodeURIComponent(src)}`} alt={name} width={size} height={size} onError={() => setBroken(true)} className="shrink-0 rounded-full object-cover ring-2 ring-white/10" style={{ width: size, height: size }} />
  );
}
