"use client";
import { useEffect, useState } from "react";
import { Heart } from "./FloatingHearts";
import { HeartFrame, IconBurst } from "./Love3D";

/** Full-screen "It's a match" moment with a burst of hearts. Shown once per page view. */
export function MatchBurst({ a, b, score, onClose }: { a: { name: string; photo?: string }; b: { name: string; photo?: string }; score: number; onClose: () => void }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => (setShow(false), onClose()), 5200);
    return () => clearTimeout(t);
  }, [onClose]);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14061c]/80 backdrop-blur-md" onClick={() => (setShow(false), onClose())}>
      <div className="relative">
        <IconBurst radius={300} size={86} />
        {Array.from({ length: 28 }, (_, i) => {
          const ang = (i / 28) * Math.PI * 2;
          const dist = 160 + (i % 4) * 60;
          return (
            <span key={i} className="burst text-pink-400" style={{ "--x": `${Math.cos(ang) * dist}px`, "--y": `${Math.sin(ang) * dist}px`, animationDelay: `${(i % 5) * 0.08}s` } as React.CSSProperties}>
              <Heart size={14 + (i % 3) * 8} />
            </span>
          );
        })}
        <div className="pop relative space-y-6 text-center">
          <div className="font-display text-6xl italic text-love md:text-7xl">It&apos;s a match!</div>
          <div className="flex items-center justify-center gap-2 md:gap-6">
            <div className="-rotate-6"><HeartFrame src={a.photo} name={a.name} size={190} /></div>
            <Heart size={56} className="beat text-pink-500" />
            <div className="rotate-6"><HeartFrame src={b.photo} name={b.name} size={190} /></div>
          </div>
          <div className="flex justify-center gap-6 font-display text-xl italic"><span>{a.name}</span><span className="text-pink-400">&</span><span>{b.name}</span></div>
          <div className="text-lg text-white/80">Both agents want a second date · <span className="font-semibold text-pink-300">{score}% fit</span></div>
        </div>
      </div>
    </div>
  );
}

/** Circular score ring. */
export function ScoreRing({ value, size = 64, label }: { value: number; size?: number; label?: string }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ring" x1="0" x2="1">
            <stop offset="0" stopColor="#ff4d8d" />
            <stop offset="1" stopColor="#ff9a6b" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#ffffff1a" strokeWidth="5" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="url(#ring)" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ transition: "stroke-dashoffset 1.2s ease" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-semibold" style={{ height: size, fontSize: size / 4 }}>{value}</div>
      {label && <div className="mt-1 text-[10px] uppercase tracking-wide text-white/50">{label}</div>}
    </div>
  );
}
