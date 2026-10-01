import { NextRequest, NextResponse } from "next/server";
import { getDate, getPerson } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const d = await getDate(id);
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const who = async (pid: string) => {
    const p = await getPerson(pid);
    return { id: pid, name: p?.analysis?.name ?? pid, photo: p?.photo, oneLiner: p?.analysis?.oneLiner, gender: p?.gender };
  };
  return NextResponse.json({ date: d, people: { [d.a]: await who(d.a), [d.b]: await who(d.b) } });
}
