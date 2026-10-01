"use client";
import { Avatar } from "./Avatar";

export const ICONS3D = ["arrow-heart", "love-letter", "message", "gift-bag", "calendar", "pin"] as const;

/** A person's photo sitting inside the 3D heart-ring frame. */
export function HeartFrame({ src, name, size = 220, className = "" }: { src?: string; name: string; size?: number; className?: string }) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-[28%] shadow-[0_20px_60px_-15px_#ff4d8d99] ${className}`} style={{ width: size, height: size, background: "url(/3d/heart-frame.jpg) center/cover" }}>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full ring-4 ring-white/80" style={{ width: size * 0.46, height: size * 0.46 }}>
        <Avatar src={src} name={name} size={Math.round(size * 0.46)} />
      </div>
    </div>
  );
}

/** One glossy 3D icon that pops in with a spring, then bobs. */
export function Icon3D({ name, size = 64, delay = 0, className = "", style }: { name: (typeof ICONS3D)[number]; size?: number; delay?: number; className?: string; style?: React.CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/3d/${name}.png`} alt="" aria-hidden width={size} height={size} className={`bubble-pop pointer-events-none select-none object-contain drop-shadow-[0_10px_20px_rgba(255,77,141,0.45)] ${className}`} style={{ width: size, height: size, animationDelay: `${delay}ms, ${delay + 700}ms`, ...style }} />
  );
}

/** Icons bursting out around a center point, like bubbles. */
export function IconBurst({ radius = 220, size = 70 }: { radius?: number; size?: number }) {
  const list = [...ICONS3D, ...ICONS3D];
  return (
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
      {list.map((n, i) => {
        const ang = (i / list.length) * Math.PI * 2 - Math.PI / 2;
        const r = radius * (i % 2 ? 1.15 : 0.9);
        return <Icon3D key={i} name={n} size={size * (i % 2 ? 0.75 : 1)} delay={i * 90} className="absolute" style={{ left: Math.cos(ang) * r, top: Math.sin(ang) * r }} />;
      })}
    </div>
  );
}
