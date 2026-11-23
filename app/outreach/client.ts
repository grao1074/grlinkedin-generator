import type { Lead, LeadStatus, LeadsResponse, Settings } from '../../types/outreach';

/** Small typed wrapper around the outreach API. Throws Error(message) on failure. */
async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error('Could not reach the local server. Is `bun dev` still running?');
  }
  const body = (await res.json().catch(() => null)) as ({ ok: boolean; message?: string } & T) | null;
  if (!body) throw new Error(`Server error (HTTP ${res.status}).`);
  if (!body.ok) throw new Error(body.message || `Request failed (HTTP ${res.status}).`);
  return body;
}

const post = <T>(url: string, data: unknown = {}, method = 'POST') =>
  call<T>(url, { method, body: JSON.stringify(data) });

export const api = {
  leads: () => call<LeadsResponse>('/api/outreach/leads'),
  importSheet: () => post<{ message: string }>('/api/outreach/import'),
  processAllNew: () => post<{ message: string }>('/api/outreach/process', { allNew: true }),
  process: (ids: string[]) => post<{ message: string }>('/api/outreach/process', { ids }),
  chooseMatch: (id: string, url: string) => post<object>(`/api/outreach/leads/${id}/match`, { url }),
  redraft: (id: string, note?: string) => post<object>(`/api/outreach/leads/${id}/draft`, { note }),
  action: (id: string, action: string, extra: Record<string, unknown> = {}) =>
    post<{ lead?: Lead }>(`/api/outreach/leads/${id}`, { action, ...extra }, 'PATCH'),
  send: (ids: string[]) => post<{ message: string }>('/api/outreach/send', { ids }),
  settings: () => call<{ settings: Settings; suppression: string[] }>('/api/outreach/settings'),
  saveSettings: (settings: Settings, suppression: string[]) =>
    post<{ settings: Settings; suppression: string[] }>('/api/outreach/settings', { settings, suppression }, 'PUT'),
};

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  searching: 'Searching LinkedIn',
  'needs-match': 'Pick the right person',
  enriching: 'Fetching details',
  enriched: 'Details found',
  drafting: 'Writing draft',
  drafted: 'Ready to review',
  approved: 'Approved',
  sending: 'Sending',
  sent: 'Sent',
  skipped: 'Skipped',
  failed: 'Failed',
};

export const STATUS_STYLE: Record<LeadStatus, string> = {
  new: 'bg-gray-100 text-gray-700',
  searching: 'bg-blue-50 text-blue-700',
  'needs-match': 'bg-amber-100 text-amber-800',
  enriching: 'bg-blue-50 text-blue-700',
  enriched: 'bg-sky-100 text-sky-800',
  drafting: 'bg-blue-50 text-blue-700',
  drafted: 'bg-violet-100 text-violet-800',
  approved: 'bg-green-100 text-green-800',
  sending: 'bg-blue-50 text-blue-700',
  sent: 'bg-green-600 text-white',
  skipped: 'bg-gray-100 text-gray-500',
  failed: 'bg-red-100 text-red-700',
};

/** Leads that need you to do something on the Review tab. */
export function needsAttention(l: Lead): boolean {
  return l.status === 'needs-match' || l.status === 'drafted' || l.status === 'failed' || l.status === 'enriched';
}
