import { NextRequest, NextResponse } from "next/server";
import { isRunning, rankingsFor } from "@/lib/pipeline";
import { getPerson, listDates, listPeople } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = await getPerson(id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [people, allDates] = await Promise.all([listPeople(), listDates()]);
  const byId = new Map(people.map((x) => [x.id, x]));
  const dates = allDates.filter((d) => d.a === id || d.b === id).map((d) => ({
    id: d.id,
    with: d.a === id ? d.b : d.a,
    withName: byId.get(d.a === id ? d.b : d.a)?.analysis?.name,
    withPhoto: byId.get(d.a === id ? d.b : d.a)?.photo,
    initiatedByMe: d.a === id,
    status: d.status,
    venue: d.venue,
    scene: d.scene ?? d.venue?.scene,
    messages: d.messages.length,
    myDebrief: d.debriefs[id],
    theirDebrief: d.debriefs[d.a === id ? d.b : d.a],
  }));
  const { linkedin, instagram, ...rest } = p;
  return NextResponse.json({
    person: {
      ...rest,
      sources: {
        linkedin: linkedin && { name: linkedin.name, headline: linkedin.headline, location: linkedin.location, method: linkedin.method, experience: linkedin.experience.length, posts: linkedin.posts.length },
        instagram: instagram && { username: instagram.username, bio: instagram.bio, followers: instagram.followers, method: instagram.method, posts: instagram.posts.length, images: instagram.posts.filter((x) => x.imageUrl).slice(0, 6).map((x) => x.imageUrl) },
      },
    },
    running: {
      ingest: isRunning(`ingest:${id}`),
      dating: p.datingStatus === "choosing" || allDates.some((d) => (d.a === id || d.b === id) && !["done", "error"].includes(d.status)),
    },
    dates,
    rankings: p.status === "ready" ? await rankingsFor(id, { people, dates: allDates }) : [],
  });
}
