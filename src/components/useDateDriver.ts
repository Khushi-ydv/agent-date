"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Drives dates forward from the browser: repeatedly POSTs /api/dates/[id]/step until each date is done.
 * Serverless-friendly (every request is one short LLM step) and resumable (re-opening the page continues).
 * On rate limits it backs off and surfaces a friendly notice instead of failing.
 */
export function useDateDriver(dateIds: string[], onProgress: () => void) {
  const [notice, setNotice] = useState<string | null>(null);
  const active = useRef(new Set<string>());
  const progress = useRef(onProgress);
  progress.current = onProgress;
  const key = [...dateIds].sort().join(",");

  useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split(",") : [];
    for (const id of ids) {
      if (active.current.has(id)) continue;
      active.current.add(id);
      (async () => {
        let backoff = 4000;
        let failures = 0;
        while (!cancelled) {
          try {
            const res = await fetch(`/api/dates/${id}/step`, { method: "POST" });
            const body = await res.json().catch(() => ({}));
            if (res.ok) {
              failures = 0;
              backoff = 4000;
              setNotice(null);
              progress.current();
              if (body.status === "done" || body.status === "error") break;
              continue;
            }
            if (res.status === 404) break;
            failures++;
            setNotice(body.error ?? "The agents are catching their breath — retrying…");
          } catch {
            failures++;
            setNotice("Connection hiccup — retrying…");
          }
          if (failures >= 6) break; // give up quietly; the page offers a manual resume
          await new Promise((r) => setTimeout(r, backoff));
          backoff = Math.min(backoff * 2, 30000);
        }
        if (!cancelled) active.current.delete(id);
        progress.current();
      })();
    }
    return () => {
      // Stop this effect's loops; the next run restarts drivers for the current id set (the server-side
      // lock makes any brief overlap harmless).
      cancelled = true;
      active.current.clear();
    };
  }, [key]);

  return notice;
}
