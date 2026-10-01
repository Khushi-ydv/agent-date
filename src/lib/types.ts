import type { InstagramProfile, LinkedInProfile } from "./scrape/types";

export type Source = "linkedin" | "instagram" | "both";

export interface Evidenced {
  label: string;
  detail: string; // why the agent believes this
  source: Source;
  confidence: number; // 0-1
}

export interface Analysis {
  name: string;
  oneLiner: string; // the agent's one-sentence read of the person
  summary: string; // 3-4 sentence narrative
  location?: string;
  ageRange?: string;
  career: { role: string; stage: string; ambition: string };
  needs: Evidenced[]; // what they need from a partner / relationship
  hobbies: Evidenced[];
  interests: Evidenced[];
  values: Evidenced[];
  personality: { trait: string; score: number; note: string }[]; // Big Five, 0-100
  lifestyle: { label: string; value: string }[]; // pace, social energy, fitness, travel, work-life...
  communicationStyle: string;
  loveLanguage: string;
  lookingFor: string;
  greenFlags: string[];
  watchOuts: string[];
  dealbreakers: string[];
  idealFirstDate: string;
  conversationHooks: string[];
  agentVoice: string; // how the agent should sound when it speaks for them
  readingNotes: string[]; // the agent's step-by-step observations while reading the sources
}

export interface LogEntry {
  t: number;
  step: string;
  detail?: string;
}

export interface Person {
  id: string;
  createdAt: number;
  linkedinUrl: string;
  instagramUrl: string;
  status: "queued" | "scraping" | "analyzing" | "ready" | "error";
  datingStatus?: "idle" | "choosing" | "dating" | "done" | "error";
  error?: string;
  log: LogEntry[];
  photo?: string;
  linkedin?: LinkedInProfile;
  instagram?: InstagramProfile;
  analysis?: Analysis;
  shortlist?: { id: string; interest: number; reason: string }[]; // who this agent wanted to ask out
}

export interface DateMessage {
  from: string; // person id
  say: string;
  thought: string; // the agent's private aside, shown in the UI as "agent's notes"
  t: number;
}

export interface Debrief {
  chemistry: number;
  valuesFit: number;
  lifestyleFit: number;
  goalsFit: number;
  overall: number; // 0-100
  secondDate: boolean;
  highlight: string;
  concern: string;
  reportToHuman: string; // what the agent tells its person afterwards
}

export interface DateRecord {
  id: string;
  a: string; // initiator
  b: string;
  createdAt: number;
  status: "planning" | "live" | "debrief" | "done" | "error";
  error?: string;
  venue?: { place: string; activity: string; why: string };
  messages: DateMessage[];
  debriefs: Record<string, Debrief>;
}

export interface RankingRow {
  id: string;
  name: string;
  photo?: string;
  oneLiner?: string;
  score: number; // 0-100
  basis: "mutual-date" | "one-sided-date" | "pre-date";
  myScore?: number;
  theirScore?: number;
  mutualSecondDate?: boolean;
  dateId?: string;
  reason: string;
}
