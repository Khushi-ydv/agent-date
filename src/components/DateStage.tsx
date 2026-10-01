"use client";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { Heart } from "./FloatingHearts";
import { Icon3D } from "./Love3D";
import { SCENE_META, type SceneKey } from "./ScenePicker";
import type { DateMessage } from "@/lib/types";

type Who = { id: string; name: string; photo?: string; gender?: string };

/** A person and their AI twin (same photo, holographic) — the agent who dates on their behalf. */
function AgentTwin({ who, speaking, side }: { who: Who; speaking: boolean; side: "left" | "right" }) {
  return (
    <div className={`flex flex-col items-center gap-1 transition duration-500 ${speaking ? "scale-105" : "scale-95 opacity-85"}`}>
      <div className="relative" style={{ width: 132, height: 110 }}>
        {/* the human, behind */}
        <div className={`absolute top-0 ${side === "left" ? "left-0" : "right-0"} opacity-80`}>
          <Avatar src={who.photo} name={who.name} size={70} />
          <div className={`absolute -top-2 ${side === "left" ? "-left-2" : "-right-2"} rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] backdrop-blur`}>👤 human</div>
        </div>
        {/* the agent twin, in front */}
        <div className={`absolute bottom-0 ${side === "left" ? "right-0" : "left-0"}`}>
          <div className={`relative overflow-hidden rounded-full ring-4 ${speaking ? "ring-pink-400 shadow-[0_0_30px_#ff4d8d]" : "ring-white/30"}`}>
            <div className="holo"><Avatar src={who.photo} name={who.name} size={84} /></div>
            <div className="holo-overlay absolute inset-0" />
          </div>
          <div className="absolute -right-1 -top-1 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 px-1.5 py-0.5 text-[9px] font-bold">AI</div>
        </div>
      </div>
      <div className="rounded-full bg-black/50 px-3 py-0.5 text-xs backdrop-blur">{who.name.split(" ")[0]}&apos;s agent</div>
    </div>
  );
}

function pickVoice(gender?: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return undefined;
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  const fem = /samantha|victoria|karen|moira|tessa|fiona|female|zira|susan|serena|allison|ava/i;
  const male = /daniel|alex|fred|male|david|mark|tom|oliver|aaron|arthur|rishi/i;
  return voices.find((v) => (gender === "woman" ? fem : male).test(v.name)) ?? voices[0];
}

export function DateStage({ scene, venue, a, b, messages, live }: { scene?: SceneKey; venue?: { place: string; activity: string }; a: Who; b: Who; messages: DateMessage[]; live: boolean }) {
  const meta = SCENE_META[scene ?? "cafe"] ?? SCENE_META.cafe;
  const [playIdx, setPlayIdx] = useState<number | null>(null); // replay mode for finished dates
  const [voice, setVoice] = useState(false);
  const spoken = useRef(-1);

  const shown = playIdx === null ? messages : messages.slice(0, playIdx + 1);
  const last = shown.at(-1);
  const speakerIsA = last ? last.from === a.id : true;

  // Replay: advance after the line is spoken (voice) or after a reading delay.
  useEffect(() => {
    if (playIdx === null) return;
    if (playIdx >= messages.length - 1) {
      const t = setTimeout(() => setPlayIdx(null), 4000);
      return () => clearTimeout(t);
    }
    if (voice) return; // speech end handler advances
    const t = setTimeout(() => setPlayIdx((i) => (i === null ? null : i + 1)), Math.min(7000, 1800 + (messages[playIdx]?.say.length ?? 0) * 35));
    return () => clearTimeout(t);
  }, [playIdx, voice, messages]);

  // Voice: read each new line aloud with a voice matching the speaker.
  useEffect(() => {
    if (!voice || !last || typeof window === "undefined" || !window.speechSynthesis) return;
    const idx = shown.length - 1;
    if (spoken.current === idx) return;
    spoken.current = idx;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(last.say);
    const who = last.from === a.id ? a : b;
    u.voice = pickVoice(who.gender) ?? null;
    u.rate = 1.03;
    u.pitch = who.gender === "woman" ? 1.15 : 0.9;
    u.onend = () => setPlayIdx((i) => (i === null ? null : i + 1));
    window.speechSynthesis.speak(u);
  }, [voice, last, shown.length, a, b]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  return (
    <section className="relative aspect-[16/10] w-full overflow-hidden rounded-[2rem] border border-white/10 md:aspect-[16/9]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={meta.img} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#14061c] via-[#14061c]/20 to-[#14061c]/50" />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
        <div className="flex items-center gap-2 rounded-2xl bg-black/40 px-3 py-2 backdrop-blur">
          <Icon3D name="pin" size={34} />
          <div>
            <div className="font-display text-lg italic leading-tight">{venue?.place ?? "Planning the date…"}</div>
            {venue && <div className="text-xs text-white/70">{venue.activity}</div>}
          </div>
        </div>
        <div className="flex gap-2">
          {!live && messages.length > 0 && (
            <button className="btn-ghost bg-black/40" onClick={() => { spoken.current = -1; setPlayIdx(playIdx === null ? 0 : null); }}>{playIdx === null ? "▶ Play the date" : "■ Stop"}</button>
          )}
          <button className={`btn-ghost bg-black/40 ${voice ? "border-pink-400 text-pink-200" : ""}`} onClick={() => { if (voice) window.speechSynthesis?.cancel(); spoken.current = voice ? -1 : shown.length - 1; setVoice(!voice); }}>{voice ? "🔊 Voices on" : "🔇 Voices off"}</button>
        </div>
      </div>

      {/* speech bubble */}
      {last && (
        <div key={shown.length} className={`speech absolute bottom-[42%] max-w-[64%] md:max-w-[55%] ${speakerIsA ? "left-[5%]" : "right-[5%]"}`}>
          <div className={`relative rounded-3xl px-5 py-3.5 text-sm leading-relaxed shadow-2xl md:text-base ${speakerIsA ? "rounded-bl-md bg-white text-[#2a0f2e]" : "rounded-br-md bg-gradient-to-br from-pink-500 to-orange-400 text-white"}`}>
            <div className={`wave mb-1 h-3 ${speakerIsA ? "text-pink-500" : "text-white/80"}`} aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ animationDelay: `${i * 0.12}s`, height: 10 }} />)}
            </div>
            <span className="line-clamp-4">{last.say}</span>
          </div>
        </div>
      )}
      {!last && <div className="absolute inset-x-0 top-[40%] text-center font-display text-2xl italic text-white/80">{live ? "The agents are on their way…" : ""}</div>}

      {/* the two agents */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 md:p-6">
        <AgentTwin who={a} side="left" speaking={!!last && speakerIsA} />
        <div className="mb-10 flex flex-col items-center">
          <Heart size={40} className={`text-pink-500 drop-shadow-[0_0_14px_#ff4d8d] ${live || playIdx !== null ? "beat" : ""}`} />
          <div className="text-xs text-white/60">{shown.length}/{Math.max(shown.length, messages.length, 8)} lines</div>
        </div>
        <AgentTwin who={b} side="right" speaking={!!last && !speakerIsA} />
      </div>
    </section>
  );
}
