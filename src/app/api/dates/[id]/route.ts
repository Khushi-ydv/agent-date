import { NextRequest, NextResponse } from "next/server";
import { getDate, getPerson } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const d = getDate(id);
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const who = (pid: string) => {
    const p = getPerson(pid);
    return { id: pid, name: p?.analysis?.name ?? pid, photo: p?.photo, oneLiner: p?.analysis?.oneLiner };
  };
  return NextResponse.json({ date: d, people: { [d.a]: who(d.a), [d.b]: who(d.b) } });
}
