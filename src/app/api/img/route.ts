// Image proxy: Instagram/LinkedIn CDNs block hotlinking from other origins, so the browser loads them via us.
import { NextRequest } from "next/server";

const ALLOWED = /(^|\.)(cdninstagram\.com|fbcdn\.net|licdn\.com)$/;

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  let host = "";
  try {
    host = new URL(u ?? "").hostname;
  } catch {}
  if (!u || !ALLOWED.test(host)) return new Response("bad url", { status: 400 });
  const res = await fetch(u, { signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!res?.ok) return new Response("not found", { status: 404 });
  return new Response(res.body, {
    headers: { "Content-Type": res.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "public, max-age=86400" },
  });
}
