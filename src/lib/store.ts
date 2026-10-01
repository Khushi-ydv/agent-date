// Storage. Two layers:
//  1. Bundled demo data: data/people/*.json + data/dates/*.json, shipped in the repo (read-only on Vercel).
//  2. Writable layer: Upstash Redis (KV_REST_API_URL/TOKEN, e.g. via Vercel Marketplace) when configured,
//     otherwise the local filesystem (DATA_DIR, default ./data; /tmp/data on Vercel as a last resort).
// Reads prefer the writable layer, so new runs override the bundled demo.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";
import type { DateRecord, Person } from "./types";

const BUNDLED = path.join(process.cwd(), "data");
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = !!(REDIS_URL && REDIS_TOKEN);
const FS_ROOT = process.env.DATA_DIR || (process.env.VERCEL ? "/tmp/data" : BUNDLED);

type Kind = "people" | "dates";
const safe = (id: string) => id.replace(/[^a-z0-9._-]/gi, "_");

// ---------- filesystem ----------
function fsDir(root: string, kind: Kind) {
  const d = path.join(root, kind);
  if (root !== BUNDLED || !process.env.VERCEL) mkdirSync(d, { recursive: true });
  return d;
}
function fsRead<T>(root: string, kind: Kind, id: string): T | null {
  try {
    return JSON.parse(readFileSync(path.join(root, kind, `${safe(id)}.json`), "utf8")) as T;
  } catch {
    return null;
  }
}
function fsList(root: string, kind: Kind): string[] {
  const d = path.join(root, kind);
  if (!existsSync(d)) return [];
  return readdirSync(d).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
}
function fsWrite(kind: Kind, id: string, data: unknown) {
  const file = path.join(fsDir(FS_ROOT, kind), `${safe(id)}.json`);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, file);
}

// ---------- redis (Upstash REST) ----------
async function redis<T = unknown>(...cmd: (string | number)[]): Promise<T> {
  const res = await fetch(REDIS_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const body = await res.json();
  if (body.error) throw new Error(`redis: ${body.error}`);
  return body.result as T;
}
const rkey = (kind: Kind, id: string) => `ph:${kind}:${id}`;

// ---------- generic ----------
async function read<T>(kind: Kind, id: string): Promise<T | null> {
  if (useRedis) {
    const v = await redis<string | null>("GET", rkey(kind, id));
    if (v) return JSON.parse(v) as T;
  } else if (FS_ROOT !== BUNDLED) {
    const v = fsRead<T>(FS_ROOT, kind, id);
    if (v) return v;
  }
  return fsRead<T>(BUNDLED, kind, id);
}

async function write(kind: Kind, id: string, data: unknown) {
  if (useRedis) {
    await redis("SET", rkey(kind, id), JSON.stringify(data));
    await redis("SADD", `ph:${kind}`, id);
  } else fsWrite(kind, id, data);
}

async function list<T>(kind: Kind): Promise<T[]> {
  const ids = new Set(fsList(BUNDLED, kind));
  if (useRedis) for (const id of await redis<string[]>("SMEMBERS", `ph:${kind}`)) ids.add(id);
  else if (FS_ROOT !== BUNDLED) for (const id of fsList(FS_ROOT, kind)) ids.add(id);
  const all = [...ids];
  let fresh: (string | null)[] = [];
  if (useRedis && all.length) fresh = await redis<(string | null)[]>("MGET", ...all.map((id) => rkey(kind, id)));
  return all
    .map((id, i) => (fresh[i] ? (JSON.parse(fresh[i]!) as T) : FS_ROOT !== BUNDLED && !useRedis ? (fsRead<T>(FS_ROOT, kind, id) ?? fsRead<T>(BUNDLED, kind, id)) : fsRead<T>(BUNDLED, kind, id)))
    .filter((x): x is T => !!x);
}

// ---------- people ----------
export const getPerson = (id: string) => read<Person>("people", id);
export const savePerson = (p: Person) => write("people", p.id, p);

export async function listPeople(): Promise<Person[]> {
  return (await list<Person>("people")).sort((a, b) => a.createdAt - b.createdAt);
}

/** Read-modify-write helper. */
export async function updatePerson(id: string, fn: (p: Person) => void): Promise<Person> {
  const p = await getPerson(id);
  if (!p) throw new Error(`person ${id} not found`);
  fn(p);
  await savePerson(p);
  return p;
}

export async function logStep(id: string, step: string, detail?: string) {
  await updatePerson(id, (p) => p.log.push({ t: Date.now(), step, detail }));
}

// ---------- dates ----------
export const getDate = (id: string) => read<DateRecord>("dates", id);
export const saveDate = (d: DateRecord) => write("dates", d.id, d);

export async function listDates(): Promise<DateRecord[]> {
  return (await list<DateRecord>("dates")).sort((a, b) => a.createdAt - b.createdAt);
}

export const pairId = (x: string, y: string) => [x, y].sort().join("__");
export async function datesFor(id: string) {
  return (await listDates()).filter((d) => d.a === id || d.b === id);
}

// ---------- short-lived locks (one step per date at a time, across tabs/instances) ----------
const memLocks = new Map<string, number>();
export async function tryLock(key: string, ttlSec = 90): Promise<boolean> {
  if (useRedis) return (await redis<string | null>("SET", `ph:lock:${key}`, "1", "NX", "EX", ttlSec)) === "OK";
  const now = Date.now();
  if ((memLocks.get(key) ?? 0) > now) return false;
  memLocks.set(key, now + ttlSec * 1000);
  return true;
}
export async function unlock(key: string) {
  if (useRedis) await redis("DEL", `ph:lock:${key}`);
  else memLocks.delete(key);
}
