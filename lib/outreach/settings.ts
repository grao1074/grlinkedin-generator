import type { Lead, Settings } from '../../types/outreach';
import { DEFAULT_SETTINGS } from '../../types/outreach';
import { isValidEmail } from './mime';

const LIMITS: Partial<Record<keyof Settings, number>> = {
  senderName: 100,
  senderEmail: 200,
  replyTo: 200,
  about: 2000,
  offer: 2000,
  callToAction: 500,
  tone: 500,
  signature: 500,
  optOutText: 500,
  postalAddress: 300,
};

const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Validate settings from the dashboard. Returns the clean settings or an error message. */
export function sanitizeSettings(input: Record<string, unknown>): { settings: Settings } | { error: string } {
  const s: Settings = { ...DEFAULT_SETTINGS };
  for (const [key, max] of Object.entries(LIMITS) as [keyof Settings, number][]) {
    const v = input[key];
    (s as unknown as Record<string, unknown>)[key] = typeof v === 'string' ? v.trim().slice(0, max) : '';
  }
  for (const key of ['senderName', 'senderEmail', 'replyTo'] as const) s[key] = s[key].replace(/[\r\n]+/g, ' ');
  if (s.senderEmail && !isValidEmail(s.senderEmail)) return { error: 'Your Gmail address does not look like an email address.' };
  if (s.replyTo && !isValidEmail(s.replyTo)) return { error: 'The reply-to address does not look like an email address.' };
  if (!s.optOutText) return { error: 'Keep an opt-out line. Cold email without one can break anti-spam law (CAN-SPAM, PECR/GDPR).' };
  s.dailySendCap = Math.round(clamp(input.dailySendCap, 1, 200, DEFAULT_SETTINGS.dailySendCap));
  s.sendDelaySeconds = Math.round(clamp(input.sendDelaySeconds, 0, 600, DEFAULT_SETTINGS.sendDelaySeconds));
  s.matchThreshold = Math.round(clamp(input.matchThreshold, 0.5, 1, DEFAULT_SETTINGS.matchThreshold) * 100) / 100;
  return { settings: s };
}

/** Lowercased, valid, unique emails. */
export function sanitizeSuppression(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const v of input.slice(0, 10_000)) {
    if (typeof v === 'string' && isValidEmail(v)) out.add(v.trim().toLowerCase());
  }
  return Array.from(out);
}

/** Quote a CSV cell, and stop spreadsheet apps treating it as a formula. */
export function csvCell(value: unknown): string {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function leadsToCsv(leads: Lead[]): string {
  const header = ['First Name', 'Last Name', 'Company', 'Email', 'Status', 'LinkedIn URL', 'Company URL', 'Subject', 'Body', 'Sent At', 'Note'];
  const rows = leads.map((l) => [
    l.firstName, l.lastName, l.company, l.email, l.status, l.profileUrl ?? '', l.companyUrl ?? '',
    l.draft?.subject ?? '', l.draft?.body ?? '', l.sentAt ?? '', l.error ?? '',
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}
