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

// ---------- speech (browser text-to-speech) ----------
const FEM = /samantha|victoria|karen|moira|tessa|fiona|female|zira|susan|serena|allison|ava|jenny|aria|sonia|libby|natasha|google uk english female|google us english/i;
const MALE = /daniel|alex|fred|\bmale|david|mark|tom|oliver|aaron|arthur|rishi|guy|ryan|thomas|google uk english male/i;

function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    const load = () => setVoices(synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en")));
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, []);
  return voices;
}

/** Pick distinct voices for the two agents, matching gender where the browser offers it. */
// Most natural-sounding voices first (Chrome's Google voices, macOS/iOS Samantha & Daniel, Edge's neural voices).
const BEST = /google|samantha|daniel|natural|neural|aria|jenny|guy|serena|oliver/i;

function voiceFor(voices: SpeechSynthesisVoice[], gender: string | undefined, avoid?: SpeechSynthesisVoice) {
  const pref = voices
    .filter((v) => (gender === "woman" ? FEM : MALE).test(v.name))
    .sort((x, y) => Number(BEST.test(y.name)) - Number(BEST.test(x.name)));
  return pref.find((v) => v !== avoid) ?? pref[0] ?? voices.find((v) => v !== avoid) ?? voices[0];
}

/** Split long text into sentence chunks: Chrome silently stops utterances longer than ~15s. */
function chunks(text: string) {
  const parts = text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text];
  const out: string[] = [];
  for (const p of parts) {
    if (out.length && (out[out.length - 1] + p).length < 180) out[out.length - 1] += p;
    else out.push(p);
  }
  return out.map((c) => c.trim()).filter(Boolean);
}

const keepAlive: SpeechSynthesisUtterance[] = []; // Chrome can GC utterances mid-speech, dropping onend

export function DateStage({ dateId, scene, venue, a, b, messages, live }: { dateId: string; scene?: SceneKey; venue?: { place: string; activity: string }; a: Who; b: Who; messages: DateMessage[]; live: boolean }) {
  const meta = SCENE_META[scene ?? "cafe"] ?? SCENE_META.cafe;
  const [playIdx, setPlayIdx] = useState<number | null>(null); // replay mode for finished dates
  const [voice, setVoice] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [loadingVoice, setLoadingVoice] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const neuralDown = useRef(0); // consecutive neural-voice failures; after 2 we use the browser voice
  const voices = useVoices();
  const spokenIdx = useRef(-1);
  const gen = useRef(0); // bumps on every new line / stop, so stale speech callbacks are ignored
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  const shown = playIdx === null ? messages : messages.slice(0, playIdx + 1);
  const last = shown.at(-1);
  const speakerIsA = last ? last.from === a.id : true;

  const stopSpeech = () => {
    gen.current++;
    audioRef.current?.pause();
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
    setLoadingVoice(false);
  };

  const lineSrc = (m: DateMessage, idx: number) => m.audio ?? `/api/tts/${encodeURIComponent(dateId)}/${idx}?t=${m.t}`;

  /** Neural voice (Groq Orpheus, or a bundled pre-render) with browser speech as the fallback. */
  const playLine = (m: DateMessage, idx: number, onDone?: () => void) => {
    if (neuralDown.current >= 2) return speakLine(m, idx, onDone);
    const my = ++gen.current;
    spokenIdx.current = idx;
    audioRef.current?.pause();
    if (supported) window.speechSynthesis.cancel();
    const el = new Audio(lineSrc(m, idx));
    audioRef.current = el;
    let finished = false;
    const done = () => {
      if (finished || my !== gen.current) return;
      finished = true;
      setSpeaking(false);
      setLoadingVoice(false);
      onDone?.();
    };
    const fallback = () => {
      if (finished || my !== gen.current) return;
      finished = true;
      neuralDown.current++;
      setLoadingVoice(false);
      speakLine(m, idx, onDone);
    };
    el.onplaying = () => {
      if (my !== gen.current) return;
      neuralDown.current = 0;
      setLoadingVoice(false);
      setSpeaking(true);
    };
    el.onended = done;
    el.onerror = fallback;
    setLoadingVoice(true);
    el.play().catch(fallback);
    // Watchdog: generation can take a few seconds the first time a line is spoken.
    setTimeout(() => (el.paused && el.currentTime === 0 ? fallback() : undefined), 25_000);
    // Warm up the next line so playback flows.
    const next = messages[idx + 1];
    if (next) fetch(lineSrc(next, idx + 1)).catch(() => {});
  };

  /** Speak one line; calls onDone when finished (or after a watchdog timeout if the browser never reports it). */
  const speakLine = (m: DateMessage, idx: number, onDone?: () => void) => {
    if (!supported) return onDone?.();
    const synth = window.speechSynthesis;
    const my = ++gen.current;
    spokenIdx.current = idx;
    synth.cancel();
    synth.resume(); // Chrome sometimes leaves the queue paused
    const who = m.from === a.id ? a : b;
    const va = voiceFor(voices, a.gender);
    const v = who === a ? va : voiceFor(voices, b.gender, va);
    const sameVoice = va && v === va && who === b;
    const parts = chunks(m.say);
    let finished = false;
    const done = () => {
      if (finished || my !== gen.current) return;
      finished = true;
      setSpeaking(false);
      onDone?.();
    };
    // Watchdog: ~70ms per character + slack.
    setTimeout(done, m.say.length * 70 + 2500);
    setSpeaking(true);
    // Small delay after cancel(): Chrome drops a speak() issued in the same tick.
    setTimeout(() => {
      if (my !== gen.current) return;
      keepAlive.length = 0;
      parts.forEach((text, i) => {
        const u = new SpeechSynthesisUtterance(text);
        if (v) u.voice = v;
        u.lang = v?.lang ?? "en-US";
        u.volume = 1;
        u.rate = 1.02;
        u.pitch = sameVoice ? 1.35 : who.gender === "woman" ? 1.1 : 0.95;
        if (i === parts.length - 1) {
          u.onend = done;
          u.onerror = (e) => {
            if (e.error !== "interrupted" && e.error !== "canceled") done();
          };
        }
        keepAlive.push(u);
        synth.speak(u);
      });
    }, 80);
  };

  // Replay without voice: advance on a reading timer.
  useEffect(() => {
    if (playIdx === null) return;
    if (playIdx >= messages.length - 1 && !(voice && (speaking || loadingVoice))) {
      const t = setTimeout(() => setPlayIdx(null), 4000);
      return () => clearTimeout(t);
    }
    if (voice) return; // with voice, speech completion advances the replay
    const t = setTimeout(() => setPlayIdx((i) => (i === null ? null : i + 1)), Math.min(7000, 1800 + (messages[playIdx]?.say.length ?? 0) * 35));
    return () => clearTimeout(t);
  }, [playIdx, voice, speaking, loadingVoice, messages]);

  // Voice on: speak each newly shown line (live dates and replays).
  const lastIdx = shown.length - 1;
  useEffect(() => {
    if (!voice || !last || spokenIdx.current === lastIdx) return;
    playLine(last, lastIdx, () => {
      if (playIdx !== null) setPlayIdx((i) => (i === null ? null : Math.min(i + 1, messages.length - 1)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice, lastIdx]);

  useEffect(() => () => { gen.current++; audioRef.current?.pause(); if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }, []);

  const toggleVoice = () => {
    if (voice) {
      stopSpeech();
      setVoice(false);
      return;
    }
    setVoice(true);
    // Start speaking inside the click (browsers require a user gesture). On a finished date, play it from the top.
    if (!live && messages.length && playIdx === null) {
      setPlayIdx(0);
      playLine(messages[0], 0, () => setPlayIdx((i) => (i === null ? null : Math.min(i + 1, messages.length - 1))));
    } else if (last) {
      playLine(last, lastIdx, () => playIdx !== null && setPlayIdx((i) => (i === null ? null : Math.min(i + 1, messages.length - 1))));
    }
  };

  const togglePlay = () => {
    if (playIdx !== null) {
      stopSpeech();
      setPlayIdx(null);
      return;
    }
    setPlayIdx(0);
    if (voice) playLine(messages[0], 0, () => setPlayIdx((i) => (i === null ? null : Math.min(i + 1, messages.length - 1))));
    else spokenIdx.current = -1;
  };

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
            <button className="btn-ghost bg-black/40" onClick={togglePlay}>{playIdx === null ? "▶ Play the date" : "■ Stop"}</button>
          )}
          {(
            <button className={`btn-ghost bg-black/40 ${voice ? "border-pink-400 text-pink-200" : ""}`} onClick={toggleVoice} title="Hear the agents (uses your browser's voices)">
              {voice ? (loadingVoice ? "🎧 Tuning voices…" : speaking ? "🔊 Speaking…" : "🔊 Voices on") : "🎧 Hear the agents"}
            </button>
          )}
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
