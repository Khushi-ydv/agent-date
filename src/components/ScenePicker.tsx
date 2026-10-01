"use client";
import { Heart } from "./FloatingHearts";
import { Icon3D } from "./Love3D";

export const SCENE_META = {
  cafe: { label: "Café", emoji: "☕", img: "/scenes/cafe.jpg", blurb: "Lattes, pastries & long talks" },
  beach: { label: "Beach", emoji: "🏖️", img: "/scenes/beach.jpg", blurb: "Barefoot walks by the waves" },
  mountain: { label: "Mountain", emoji: "🏔️", img: "/scenes/mountain.jpg", blurb: "Trails, views & fresh air" },
  sunset: { label: "Sunset", emoji: "🌅", img: "/scenes/sunset.jpg", blurb: "Golden hour, just the two of you" },
} as const;
export type SceneKey = keyof typeof SCENE_META;

export function ScenePicker({ onPick, onClose, name }: { onPick: (scene?: SceneKey) => void; onClose: () => void; name: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14061c]/85 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="pop relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <Icon3D name="pin" size={70} className="absolute -left-4 -top-10 hidden md:block" />
        <Icon3D name="calendar" size={64} delay={150} className="absolute -right-2 -top-10 hidden md:block" />
        <div className="mb-6 text-center">
          <div className="font-display text-4xl italic md:text-5xl">Where should we go?</div>
          <div className="mt-2 text-white/60">{name}&apos;s agent will plan every date around this vibe.</div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {(Object.keys(SCENE_META) as SceneKey[]).map((k, i) => (
            <button key={k} onClick={() => onPick(k)} className="pop lift group relative aspect-[3/4] overflow-hidden rounded-3xl border border-white/15 text-left" style={{ animationDelay: `${i * 90}ms` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SCENE_META[k].img} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute bottom-0 p-4">
                <div className="text-3xl">{SCENE_META[k].emoji}</div>
                <div className="font-display text-2xl italic">{SCENE_META[k].label}</div>
                <div className="text-xs text-white/70">{SCENE_META[k].blurb}</div>
              </div>
              <div className="absolute right-3 top-3 flex h-9 w-9 scale-0 items-center justify-center rounded-full bg-pink-500 transition group-hover:scale-100"><Heart size={16} /></div>
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-center gap-3">
          <button className="btn" onClick={() => onPick(undefined)}>✨ Surprise me — let the agents choose</button>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
