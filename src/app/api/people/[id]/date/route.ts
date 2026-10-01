import { after, NextRequest, NextResponse } from "next/server";
import { ingest, isRunning, sendOnDates } from "@/lib/pipeline";
import { getPerson } from "@/lib/store";
import { SCENES, type Scene } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = getPerson(id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { retry, scene } = await req.json().catch(() => ({}));
  if (retry && p.status === "error") {
    after(() => ingest(id));
    return NextResponse.json({ ok: true });
  }
  if (p.status !== "ready") return NextResponse.json({ error: "Profile is not analyzed yet" }, { status: 409 });
  const sc = SCENES.includes(scene) ? (scene as Scene) : undefined;
  if (!isRunning(`dating:${id}`)) after(() => sendOnDates(id, undefined, sc));
  return NextResponse.json({ ok: true });
}
