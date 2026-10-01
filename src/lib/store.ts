// File-backed JSON store: data/people/<id>.json and data/dates/<id>.json.
// Simple, inspectable, and the demo run ships in the repo.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";
import type { DateRecord, Person } from "./types";

const ROOT = process.env.DATA_DIR || path.join(process.cwd(), "data");
const PEOPLE = path.join(ROOT, "people");
const DATES = path.join(ROOT, "dates");
for (const d of [PEOPLE, DATES]) mkdirSync(d, { recursive: true });

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJson(file: string, data: unknown) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, file);
}

const safe = (id: string) => id.replace(/[^a-z0-9._-]/gi, "_");

export const getPerson = (id: string) => readJson<Person>(path.join(PEOPLE, `${safe(id)}.json`));
export const savePerson = (p: Person) => writeJson(path.join(PEOPLE, `${safe(p.id)}.json`), p);
export const personExists = (id: string) => existsSync(path.join(PEOPLE, `${safe(id)}.json`));

export function listPeople(): Person[] {
  return readdirSync(PEOPLE)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson<Person>(path.join(PEOPLE, f)))
    .filter((p): p is Person => !!p)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Read-modify-write helper. Single-process server, so this is safe enough. */
export function updatePerson(id: string, fn: (p: Person) => void): Person {
  const p = getPerson(id);
  if (!p) throw new Error(`person ${id} not found`);
  fn(p);
  savePerson(p);
  return p;
}

export function logStep(id: string, step: string, detail?: string) {
  updatePerson(id, (p) => p.log.push({ t: Date.now(), step, detail }));
}

export const getDate = (id: string) => readJson<DateRecord>(path.join(DATES, `${safe(id)}.json`));
export const saveDate = (d: DateRecord) => writeJson(path.join(DATES, `${safe(d.id)}.json`), d);

export function listDates(): DateRecord[] {
  return readdirSync(DATES)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson<DateRecord>(path.join(DATES, f)))
    .filter((d): d is DateRecord => !!d)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export const pairId = (x: string, y: string) => [x, y].sort().join("__");
export const datesFor = (id: string) => listDates().filter((d) => d.a === id || d.b === id);
