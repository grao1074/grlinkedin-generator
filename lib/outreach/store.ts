import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CompanySummary, Lead, ProfileSummary, Settings } from '../../types/outreach';
import { DEFAULT_SETTINGS } from '../../types/outreach';

/**
 * Everything the outreach feature remembers, kept in one JSON file on this
 * computer (data/outreach.json, ignored by git). Writes go through a queue
 * and use write-then-rename, so a crash never leaves a half-written file.
 */

export interface State {
  leads: Lead[];
  /** Keyed by LinkedIn URL, so the same person is never paid for twice. */
  profileCache: Record<string, ProfileSummary>;
  companyCache: Record<string, CompanySummary>;
  /** Lowercased emails that must never be contacted. */
  suppression: string[];
  settings: Settings;
}

function emptyState(): State {
  return { leads: [], profileCache: {}, companyCache: {}, suppression: [], settings: { ...DEFAULT_SETTINGS } };
}

function dataFile(): string {
  return path.join(process.env.OUTREACH_DATA_DIR || path.join(process.cwd(), 'data'), 'outreach.json');
}

// Kept on globalThis so Next.js hot reloads in dev share one copy.
const g = globalThis as unknown as { __outreachStore?: { state: State | null; queue: Promise<unknown>; file: string } };

function holder() {
  const file = dataFile();
  if (!g.__outreachStore || g.__outreachStore.file !== file) {
    g.__outreachStore = { state: null, queue: Promise.resolve(), file };
  }
  return g.__outreachStore;
}

async function load(): Promise<State> {
  const h = holder();
  if (h.state) return h.state;
  try {
    const parsed = JSON.parse(await readFile(h.file, 'utf8')) as Partial<State>;
    h.state = {
      ...emptyState(),
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error(`Could not read ${h.file}. Fix or move the file and try again.`);
    }
    h.state = emptyState();
  }
  return h.state;
}

async function persist(state: State) {
  const file = holder().file;
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(state, null, 1), 'utf8');
  await rename(tmp, file);
}

/** A read-only snapshot of the current state. */
export async function readState(): Promise<State> {
  const h = holder();
  await h.queue;
  return structuredClone(await load());
}

/**
 * Change the state and save it. Changes run one at a time, in order, so two
 * background jobs cannot overwrite each other.
 */
export function updateState<T>(fn: (state: State) => T): Promise<T> {
  const h = holder();
  const run = h.queue.then(async () => {
    const state = await load();
    const result = fn(state);
    await persist(state);
    return result;
  });
  h.queue = run.catch(() => undefined);
  return run;
}

/** Patch one lead. Returns the updated lead, or null if it no longer exists. */
export function updateLead(id: string, patch: Partial<Lead> | ((lead: Lead) => void)): Promise<Lead | null> {
  return updateState((s) => {
    const lead = s.leads.find((l) => l.id === id);
    if (!lead) return null;
    if (typeof patch === 'function') patch(lead);
    else Object.assign(lead, patch);
    lead.updatedAt = new Date().toISOString();
    return structuredClone(lead);
  });
}

export function isSuppressed(state: State, email: string): boolean {
  return state.suppression.includes(email.trim().toLowerCase());
}

/** Count of emails sent since local midnight. */
export function sentToday(state: State, now = new Date()): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return state.leads.filter((l) => l.sentAt && new Date(l.sentAt) >= start).length;
}

/** Forget the in-memory copy (tests use this between runs). */
export function resetStoreCache() {
  g.__outreachStore = undefined;
}
