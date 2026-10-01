// Hearts drifting up the page. Deterministic per index so server and client render identically.
const COLORS = ["#ff4d8d", "#ff7aa8", "#ff9a6b", "#ffc2d6", "#e879f9"];

export function FloatingHearts({ count = 22 }: { count?: number }) {
  const rand = (i: number, k: number) => {
    const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {Array.from({ length: count }, (_, i) => {
        const size = 10 + rand(i, 1) * 26;
        const style = {
          left: `${rand(i, 2) * 100}%`,
          "--d": `${14 + rand(i, 3) * 18}s`,
          "--delay": `${-rand(i, 4) * 30}s`,
          "--dx": `${(rand(i, 5) - 0.5) * 160}px`,
          "--r": `${(rand(i, 6) - 0.5) * 90}deg`,
          "--s": `${0.6 + rand(i, 7) * 0.8}`,
          "--o": `${0.25 + rand(i, 8) * 0.45}`,
        } as React.CSSProperties;
        return (
          <svg key={i} className="float-heart" style={style} width={size} height={size} viewBox="0 0 24 24" fill={COLORS[i % COLORS.length]}>
            <path d="M12 21s-7.5-4.6-10-9.3C.3 8.4 2.1 4.5 5.8 4.1c2-.2 3.6.8 4.6 2.3h3.2c1-1.5 2.6-2.5 4.6-2.3 3.7.4 5.5 4.3 3.8 7.6C19.5 16.4 12 21 12 21z" />
          </svg>
        );
      })}
    </div>
  );
}

export function Heart({ className = "", size = 18 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 21s-7.5-4.6-10-9.3C.3 8.4 2.1 4.5 5.8 4.1c2-.2 3.6.8 4.6 2.3h3.2c1-1.5 2.6-2.5 4.6-2.3 3.7.4 5.5 4.3 3.8 7.6C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}
