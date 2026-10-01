// Pre-renders neural voices (Groq Orpheus) for showcase dates and bundles them as AAC in public/voices/.
//   npx tsx --env-file=.env.local scripts/voices.ts <dateId> [dateId...]
// Respects the free tier (~1200 chars/min) by pacing requests; skips lines already rendered.
import { execFileSync } from "child_process";
import { mkdirSync, unlinkSync, writeFileSync } from "fs";
import { getDate, getPerson, saveDate } from "../src/lib/store";
import { synthesize, voicesForDate } from "../src/lib/tts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CPM = Number(process.env.TTS_CHARS_PER_MIN || 1100);

(async () => {
  for (const id of process.argv.slice(2)) {
    const d = await getDate(id);
    if (!d) { console.log(`skip ${id}: not found`); continue; }
    const voices = voicesForDate(d, await getPerson(d.a), await getPerson(d.b));
    mkdirSync(`public/voices/${id}`, { recursive: true });
    for (let i = 0; i < d.messages.length; i++) {
      const m = d.messages[i];
      if (m.audio) continue;
      for (let attempt = 0; ; attempt++) {
        try {
          const t0 = Date.now();
          const wav = Buffer.from(await synthesize(m.say, voices[m.from]));
          const tmp = `/tmp/voice-${id}-${i}.wav`;
          writeFileSync(tmp, wav);
          execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "48000", tmp, `public/voices/${id}/${i}.m4a`]);
          unlinkSync(tmp);
          m.audio = `/voices/${id}/${i}.m4a`;
          await saveDate(d);
          console.log(`ok ${id}#${i} ${voices[m.from]} ${m.say.length}ch`);
          await sleep(Math.max(0, (m.say.length / CPM) * 60_000 - (Date.now() - t0)));
          break;
        } catch (e) {
          if (attempt >= 4) { console.log(`FAIL ${id}#${i} ${(e as Error).message}`); break; }
          await sleep(20_000);
        }
      }
    }
  }
  console.log("DONE");
})();
