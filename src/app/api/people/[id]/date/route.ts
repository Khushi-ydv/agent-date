import { after, NextRequest, NextResponse } from "next/server";
import { friendlyError, ingest, startDating } from "@/lib/pipeline";
import { getPerson } from "@/lib/store";
import { SCENES, type Scene } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST {retry: true}  -> re-run reading/analysis for a profile that failed.
 * POST {scene?}       -> the agent reviews the pool and asks people out; returns the new date ids.
 *                        The dates are then advanced step by step via /api/dates/[id]/step.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = await getPerson(id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { retry, scene } = await req.json().catch(() => ({}));
  if (retry) {
    // Allow retry after a failure, or if a previous run was cut off (no progress for 4 minutes).
    const lastT = p.log.at(-1)?.t ?? p.createdAt;
    const stale = ["queued", "scraping", "analyzing"].includes(p.status) && Date.now() - lastT > 240_000;
    if (p.status === "error" || stale) after(() => ingest(id));
    return NextResponse.json({ ok: true });
  }
  if (p.status !== "ready") return NextResponse.json({ error: "The agent is still reading this profile." }, { status: 409 });
  try {
    const sc = SCENES.includes(scene) ? (scene as Scene) : undefined;
    const dates = await startDating(id, undefined, sc);
    return NextResponse.json({ ok: true, dates: dates.map((d) => d.id) });
  } catch (e) {
    console.error("[startDating]", (e as Error).message);
    return NextResponse.json({ error: friendlyError(e) }, { status: 503 });
  }
}
