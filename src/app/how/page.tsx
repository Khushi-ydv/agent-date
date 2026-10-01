const steps = [
  ["1. Paste two links", "A LinkedIn profile and a public Instagram. These are the only two sources any agent ever sees."],
  ["2. Scrape", "Instagram: the public profile page as served to search crawlers (bio, stats, last 12 posts + captions + images), falling back to Instagram's web API and Apify. LinkedIn: the public profile page (schema.org JSON-LD + public sections: headline, about, experience, education, posts), fetched directly or via the Jina Reader proxy when LinkedIn rate-limits us, with Bright Data / Apify as paid fallbacks."],
  ["3. The agent reads the person", "A vision LLM (Gemini) gets both sources plus 4 recent photos and writes an evidence-backed profile: needs, hobbies, interests, values, Big Five personality, lifestyle, communication style, dealbreakers, conversation hooks — every claim cites its source with a confidence score — plus its own reading notes."],
  ["4. Who can date whom", "You can state your gender and who you're looking for on the form; otherwise the agent infers gender only from the two sources (pronouns, “Mother”, “Business Dad”…) and defaults to the opposite gender. Agents only ever consider people who are mutually compatible."],
  ["5. The agent chooses dates", "Each agent reviews every compatible person's public card and scores how promising a first date would be for its own client, then asks out its top 3. You pick the vibe — Café, Beach, Mountain or Sunset — or let the agents choose."],
  ["6. The agents date", "The initiating agent plans a venue that plays to both people's hobbies. Then the two agents talk turn by turn — each is a separate LLM with only its own client's private brief and the other's public card — speaking as their client's stand-in, probing needs and dealbreakers, and keeping private notes."],
  ["7. Debrief", "After the date each agent privately scores chemistry, values, lifestyle and goals fit — calibrated like a discerning matchmaker (pleasant ≠ compatible) — decides on a second date, and writes a candid text to its human. If both say yes: it's a match."],
  ["8. Rank", "For every person, everyone else is ranked. Dated matches use the mean of BOTH agents' verdicts (+5 if both want a second date), so a match only ranks high if it works both ways. Undated people fall back to pre-date interest."],
];

export default function How() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="font-display text-5xl italic">How it works</h1>
      {steps.map(([t, d], i) => (
        <div key={t} className="glass pop p-5" style={{ animationDelay: `${i * 70}ms` }}>
          <div className="mb-1 font-display text-xl italic text-pink-300">{t}</div>
          <p className="text-white/75">{d}</p>
        </div>
      ))}
      <div className="glass p-5 text-sm text-white/60">
        Stack: Next.js 16 (App Router) · TypeScript · Tailwind · Gemini 3.5/2.5 Flash + Groq (gpt-oss, Qwen) rotated across free-tier quotas · JSON file store.
      </div>
    </div>
  );
}
