import { NextRequest, NextResponse } from "next/server";
import { advanceDate, friendlyError } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Advance a date by one step (venue → turn → … → debriefs). Idempotent-ish and lock-guarded. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const d = await advanceDate(id);
    if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ status: d.status, messages: d.messages.length });
  } catch (e) {
    console.error(`[step ${id}]`, (e as Error).message);
    return NextResponse.json({ error: friendlyError(e), retryable: true }, { status: 503 });
  }
}
