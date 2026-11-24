import { randomUUID } from 'node:crypto';
import type { Lead } from '../../types/outreach';
import { getDeps } from './deps';
import { buildEmailMessages, composeBody, missingSettings, parseDraft } from './email';
import { cell } from './google';
import {
  buildCandidates,
  companyUrlFromProfile,
  hasUsefulProfile,
  normalizePersonUrl,
  pickCompanyResult,
  pickConfident,
  summarizeCompany,
  summarizeProfile,
} from './match';
import { isValidEmail } from './mime';
import { isSuppressed, readState, sentToday, updateLead, updateState } from './store';

/**
 * The outreach pipeline. Long steps (Apify runs, AI drafts, sending) run in
 * the background in this server process; the dashboard polls lead status.
 * Nothing is ever sent unless the lead is "approved" at the moment of sending.
 */

const CONCURRENCY = 2;

interface Runtime {
  running: number;
  waiting: (() => void)[];
  busyLeads: Set<string>;
  sending: boolean;
}

const g = globalThis as unknown as { __outreachJobs?: Runtime };
const rt = (): Runtime => (g.__outreachJobs ??= { running: 0, waiting: [], busyLeads: new Set(), sending: false });

async function slot<T>(fn: () => Promise<T>): Promise<T> {
  const r = rt();
  if (r.running >= CONCURRENCY) await new Promise<void>((resolve) => r.waiting.push(resolve));
  r.running++;
  try {
    return await fn();
  } finally {
    r.running--;
    r.waiting.shift()?.();
  }
}

/** Run a lead job in the background. Returns false if that lead is already busy. */
function background(leadId: string, job: () => Promise<void>): boolean {
  const r = rt();
  if (r.busyLeads.has(leadId)) return false;
  r.busyLeads.add(leadId);
  void slot(async () => {
    try {
      await job();
    } catch (error) {
      await updateLead(leadId, { status: 'failed', error: errorText(error) });
    } finally {
      r.busyLeads.delete(leadId);
    }
  });
  return true;
}

export function isBusy(leadId: string): boolean {
  return rt().busyLeads.has(leadId);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : 'Unexpected error.';
}

/** Update the lead's sheet row. Sheet trouble never stops the pipeline. */
async function markSheet(lead: Lead | null, values: Record<string, string>) {
  if (!lead?.sheetRow) return;
  try {
    await getDeps().sheet.updateRow(lead.sheetRow, values);
  } catch (error) {
    console.warn(`[outreach] Could not update sheet row ${lead.sheetRow}: ${errorText(error)}`);
  }
}

// ---------------- Import ----------------

export interface ImportSummary {
  added: number;
  duplicates: number;
  suppressed: number;
  invalid: number;
  alreadyHandled: number;
}

/** Statuses in the sheet that mean "not touched yet". */
const UNPROCESSED = new Set(['', 'new', 'unprocessed', 'todo']);

export async function importFromSheet(): Promise<ImportSummary> {
  const rows = await getDeps().sheet.readRows();
  const summary: ImportSummary = { added: 0, duplicates: 0, suppressed: 0, invalid: 0, alreadyHandled: 0 };
  const added: Lead[] = [];

  await updateState((s) => {
    const known = new Set(s.leads.map((l) => l.email.toLowerCase()));
    const now = new Date().toISOString();
    for (const { row, values } of rows) {
      if (!UNPROCESSED.has(cell(values, 'Status').toLowerCase())) {
        summary.alreadyHandled++;
        continue;
      }
      const email = cell(values, 'Email').trim();
      const firstName = cell(values, 'First Name');
      const lastName = cell(values, 'Last Name');
      const company = cell(values, 'Company');
      if (!isValidEmail(email) || !firstName || !lastName) {
        summary.invalid++;
        continue;
      }
      const key = email.toLowerCase();
      if (known.has(key)) {
        summary.duplicates++;
        continue;
      }
      if (isSuppressed(s, key)) {
        summary.suppressed++;
        continue;
      }
      known.add(key);
      const lead: Lead = {
        id: randomUUID(),
        firstName,
        lastName,
        company,
        email,
        sheetRow: row,
        status: 'new',
        candidates: [],
        createdAt: now,
        updatedAt: now,
      };
      s.leads.push(lead);
      added.push(lead);
    }
    summary.added = added.length;
  });

  for (const lead of added) await markSheet(lead, { Status: 'Imported' });
  return summary;
}

// ---------------- Find the person ----------------

export function startProcessing(leadId: string): boolean {
  return background(leadId, async () => {
    const lead = await updateLead(leadId, { status: 'searching', error: undefined });
    if (!lead) return;
    const { settings } = await readState();
    const results = await getDeps().searchPeople(lead.firstName, lead.lastName, lead.company);
    const candidates = buildCandidates(lead, results);
    const confident = pickConfident(candidates, settings.matchThreshold);

    if (!confident) {
      await updateLead(leadId, {
        status: 'needs-match',
        candidates,
        error: candidates.length
          ? undefined
          : 'No LinkedIn profile found in search. Paste the right profile URL, or skip this lead.',
      });
      return;
    }
    await updateLead(leadId, { candidates, profileUrl: confident.url });
    await enrichAndDraft(leadId);
  });
}

/** You picked the right person (from the candidates or by pasting a URL). */
export async function chooseProfile(leadId: string, url: string): Promise<{ ok: boolean; message?: string }> {
  const profileUrl = normalizePersonUrl(url);
  if (!profileUrl) return { ok: false, message: 'That is not a LinkedIn profile URL (it should look like linkedin.com/in/name).' };
  const lead = await updateLead(leadId, (l) => {
    l.profileUrl = profileUrl;
    l.profile = undefined;
    l.companyInfo = undefined;
    l.companyUrl = undefined;
    l.draft = undefined;
    l.error = undefined;
    l.status = 'enriching';
  });
  if (!lead) return { ok: false, message: 'Lead not found.' };
  if (!background(leadId, () => enrichAndDraft(leadId))) return { ok: false, message: 'This lead is already being worked on.' };
  return { ok: true };
}

// ---------------- Profile + company details ----------------

async function enrichAndDraft(leadId: string) {
  const deps = getDeps();
  let lead = await updateLead(leadId, { status: 'enriching', error: undefined });
  if (!lead?.profileUrl) return;
  const profileUrl = lead.profileUrl;

  const state = await readState();
  let profile = state.profileCache[profileUrl];
  if (!profile) {
    const raw = await deps.fetchProfile(profileUrl);
    profile = summarizeProfile(raw, profileUrl);
    if (hasUsefulProfile(profile)) {
      const p = profile;
      await updateState((s) => {
        s.profileCache[profileUrl] = p;
      });
    }
  }
  if (!hasUsefulProfile(profile)) {
    await updateLead(leadId, {
      status: 'needs-match',
      error: 'That LinkedIn profile came back empty (private or removed). Pick another match or paste a URL.',
    });
    return;
  }

  let companyUrl = companyUrlFromProfile(profile, lead.company);
  if (!companyUrl && lead.company) {
    companyUrl = pickCompanyResult(lead.company, await deps.searchCompanies(lead.company));
  }
  let companyInfo = companyUrl ? state.companyCache[companyUrl] : undefined;
  if (companyUrl && !companyInfo) {
    try {
      const raw = await deps.fetchCompany(companyUrl);
      const summary = summarizeCompany(raw, companyUrl);
      if (summary.name) {
        companyInfo = summary;
        const url = companyUrl;
        await updateState((s) => {
          s.companyCache[url] = summary;
        });
      }
    } catch (error) {
      // The company page is a nice-to-have; carry on with the person's details.
      console.warn(`[outreach] Company lookup failed: ${errorText(error)}`);
    }
  }

  lead = await updateLead(leadId, {
    profile,
    companyUrl: companyUrl ?? undefined,
    companyInfo,
    status: 'enriched',
  });
  if (lead) await writeDraft(leadId);
}

// ---------------- Draft ----------------

async function writeDraft(leadId: string, note?: string) {
  const { settings, leads } = await readState();
  const lead = leads.find((l) => l.id === leadId);
  if (!lead) return;
  const missing = missingSettings(settings);
  if (missing.length) {
    await updateLead(leadId, {
      status: 'enriched',
      error: `Fill in Settings before drafting: ${missing.join(', ')}.`,
    });
    return;
  }

  await updateLead(leadId, { status: 'drafting', error: undefined });
  const messages = buildEmailMessages(settings, lead, lead.profile, lead.companyInfo, note);
  let draft;
  try {
    draft = parseDraft(await getDeps().chat(messages));
  } catch {
    // One retry: small local models sometimes break the JSON format.
    draft = parseDraft(
      await getDeps().chat([
        ...messages,
        { role: 'user', content: 'Your last reply was not valid JSON in the required shape. Reply with the JSON only.' },
      ])
    );
  }
  const updated = await updateLead(leadId, { draft, status: 'drafted' });
  await markSheet(updated, { Status: 'Drafted', 'LinkedIn URL': updated?.profileUrl ?? '' });
}

export function startDraft(leadId: string, note?: string): boolean {
  return background(leadId, () => writeDraft(leadId, note));
}

/** Pick up where a failed lead left off. */
export async function retry(leadId: string): Promise<boolean> {
  const lead = (await readState()).leads.find((l) => l.id === leadId);
  if (!lead) return false;
  if (lead.profile) return startDraft(leadId);
  if (lead.profileUrl) return background(leadId, () => enrichAndDraft(leadId));
  return startProcessing(leadId);
}

// ---------------- Send ----------------

export interface SendSummary {
  queued: number;
  message: string;
}

/**
 * Send approved emails, one at a time with a pause between them. Every rule
 * is re-checked right before each send: still approved, not suppressed,
 * valid address, not already sent to this address, under today's cap.
 */
export async function startSending(ids: string[]): Promise<SendSummary> {
  const r = rt();
  if (r.sending) return { queued: 0, message: 'Already sending. Wait for the current batch to finish.' };

  const state = await readState();
  const remaining = Math.max(0, state.settings.dailySendCap - sentToday(state));
  if (remaining === 0) return { queued: 0, message: `Daily cap of ${state.settings.dailySendCap} reached. Try again tomorrow.` };

  const queue = ids
    .map((id) => state.leads.find((l) => l.id === id))
    .filter((l): l is Lead => !!l && l.status === 'approved')
    .slice(0, remaining)
    .map((l) => l.id);
  if (!queue.length) return { queued: 0, message: 'Nothing approved to send.' };

  r.sending = true;
  void (async () => {
    try {
      for (let i = 0; i < queue.length; i++) {
        const sent = await sendOne(queue[i]);
        if (sent === 'cap') break;
        if (sent === 'sent' && i < queue.length - 1) {
          const { settings } = await readState();
          await new Promise((res) => setTimeout(res, Math.max(0, settings.sendDelaySeconds) * 1000));
        }
      }
    } finally {
      r.sending = false;
    }
  })();

  const capNote = ids.length > queue.length ? ` (${ids.length - queue.length} held back by the daily cap or not approved)` : '';
  return { queued: queue.length, message: `Sending ${queue.length} email${queue.length === 1 ? '' : 's'}${capNote}.` };
}

export function isSending(): boolean {
  return rt().sending;
}

async function sendOne(leadId: string): Promise<'sent' | 'skipped' | 'cap'> {
  const state = await readState();
  const lead = state.leads.find((l) => l.id === leadId);
  const { settings } = state;
  if (!lead || lead.status !== 'approved' || !lead.draft) return 'skipped';
  if (sentToday(state) >= settings.dailySendCap) return 'cap';
  if (isSuppressed(state, lead.email)) {
    await updateLead(leadId, { status: 'skipped', error: 'On the do-not-contact list.' });
    return 'skipped';
  }
  if (!isValidEmail(lead.email)) {
    await updateLead(leadId, { status: 'failed', error: 'Invalid email address.' });
    return 'skipped';
  }
  const already = state.leads.some(
    (l) => l.id !== lead.id && l.status === 'sent' && l.email.toLowerCase() === lead.email.toLowerCase()
  );
  if (already) {
    await updateLead(leadId, { status: 'skipped', error: 'Already emailed this address.' });
    return 'skipped';
  }

  await updateLead(leadId, { status: 'sending', error: undefined });
  try {
    await getDeps().sendMail({
      to: lead.email,
      subject: lead.draft.subject,
      body: composeBody(lead.draft, settings),
      fromName: settings.senderName,
      fromEmail: settings.senderEmail,
      replyTo: settings.replyTo,
    });
  } catch (error) {
    // Back to approved so you can try again; nothing was sent.
    await updateLead(leadId, { status: 'approved', error: `Send failed: ${errorText(error)}` });
    return 'skipped';
  }
  const sentAt = new Date().toISOString();
  const updated = await updateLead(leadId, { status: 'sent', sentAt });
  await markSheet(updated, { Status: 'Sent', 'Sent At': sentAt, 'LinkedIn URL': updated?.profileUrl ?? '' });
  return 'sent';
}

// ---------------- Small actions ----------------

export async function skipLead(leadId: string, doNotContact: boolean) {
  const lead = await updateState((s) => {
    const l = s.leads.find((x) => x.id === leadId);
    if (!l) return null;
    l.status = 'skipped';
    l.error = doNotContact ? 'On the do-not-contact list.' : undefined;
    l.updatedAt = new Date().toISOString();
    if (doNotContact) {
      const key = l.email.toLowerCase();
      if (!s.suppression.includes(key)) s.suppression.push(key);
    }
    return structuredClone(l);
  });
  await markSheet(lead, { Status: doNotContact ? 'Do not contact' : 'Skipped' });
  return lead;
}

/** Ids of leads in the "new" state, for "Process all new". */
export async function newLeadIds(): Promise<string[]> {
  return (await readState()).leads.filter((l) => l.status === 'new').map((l) => l.id);
}
