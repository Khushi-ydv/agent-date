export const UA = {
  chrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  bingbot: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  facebook: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchText(url: string, headers: Record<string, string>, timeoutMs = 15000) {
  const res = await fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  return { status: res.status, text: await res.text() };
}

/** Decode a JSON string literal body captured by regex (handles \uXXXX, \/ etc.). */
export function decodeJsonString(s: string): string {
  try {
    return JSON.parse(`"${s}"`);
  } catch {
    return s;
  }
}

export function decodeHtml(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

export function stripTags(html: string): string {
  // Attribute values may contain ">" (e.g. Tailwind "[&>*]"), so match quoted attributes explicitly.
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Parse "268M", "1.2K", "3,456" into a number. */
export function parseCount(s?: string): number | undefined {
  if (!s) return undefined;
  const m = s.replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return undefined;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || "").toUpperCase() as "K" | "M" | "B"] ?? 1;
  return Math.round(parseFloat(m[1]) * mult);
}
