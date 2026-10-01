import { after, NextResponse } from "next/server";
import { createPerson, ingest } from "@/lib/pipeline";
import { ScrapeError } from "@/lib/scrape";
import { listPeople } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const people = (await listPeople()).map((p) => ({
    id: p.id,
    name: p.analysis?.name ?? p.linkedin?.name ?? p.instagram?.fullName ?? p.id,
    photo: p.photo,
    oneLiner: p.analysis?.oneLiner,
    status: p.status,
    datingStatus: p.datingStatus,
    gender: p.gender,
  }));
  return NextResponse.json({ people });
}

export async function POST(req: Request) {
  const { linkedin, instagram, gender, seeking } = await req.json().catch(() => ({}));
  if (!linkedin || !instagram) return NextResponse.json({ error: "Paste both a LinkedIn and an Instagram link." }, { status: 400 });
  try {
    const g = ["man", "woman"].includes(gender) ? gender : undefined;
    const sk = ["men", "women", "everyone"].includes(seeking) ? seeking : undefined;
    const p = await createPerson(String(linkedin), String(instagram), g, sk);
    if (p.status !== "ready") after(() => ingest(p.id));
    return NextResponse.json({ id: p.id, status: p.status });
  } catch (e) {
    return NextResponse.json({ error: e instanceof ScrapeError ? e.message : (e as Error).message }, { status: 400 });
  }
}
