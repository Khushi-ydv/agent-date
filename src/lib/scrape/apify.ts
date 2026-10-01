// Optional paid fallback via Apify (free plan gives monthly credits). Used only when APIFY_TOKEN is set.
export async function runApifyActor<T = unknown>(actorId: string, input: unknown, timeoutSec = 120): Promise<T[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN not set");
  const url = `https://api.apify.com/v2/acts/${actorId.replace("/", "~")}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSec}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout((timeoutSec + 15) * 1000),
  });
  if (!res.ok) throw new Error(`Apify ${actorId} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T[];
}
