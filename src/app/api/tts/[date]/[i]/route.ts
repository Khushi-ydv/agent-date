import { NextRequest, NextResponse } from "next/server";
import { getDate, getPerson } from "@/lib/store";
import { synthesize, voicesForDate } from "@/lib/tts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/tts/<dateId>/<lineIndex>?t=<message timestamp>
 * Speaks one line of a date in the speaker's neural voice. Lines never change once written, so the
 * response is cached long-term by the CDN (the ?t= param busts the cache if a date is ever re-run).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ date: string; i: string }> }) {
  const { date: dateId, i } = await ctx.params;
  const d = await getDate(dateId);
  const m = d?.messages[Number(i)];
  if (!d || !m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const [pa, pb] = await Promise.all([getPerson(d.a), getPerson(d.b)]);
    const voice = voicesForDate(d, pa, pb)[m.from];
    const audio = await synthesize(m.say, voice);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch (e) {
    console.error(`[tts ${dateId}/${i}]`, (e as Error).message);
    return NextResponse.json({ error: "voice unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
