import { buildMime, toBase64Url, type MimeInput } from './mime';

/**
 * Google Sheets and Gmail through their REST APIs, using one OAuth refresh
 * token (created once with `bun run google:auth`). Scopes: spreadsheets and
 * gmail.send only. This app can send mail as you but cannot read your inbox.
 */

export class GoogleError extends Error {}

let cachedToken: { value: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new GoogleError('Google is not connected. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN (see README).');
  }
  let res: Response;
  try {
    res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new GoogleError('Could not reach Google to sign in.');
  }
  if (!res.ok) throw new GoogleError(`Google sign-in failed (HTTP ${res.status}). Run \`bun run google:auth\` again.`);
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new GoogleError('Google sign-in returned no access token.');
  cachedToken = { value: body.access_token, expires: Date.now() + (body.expires_in ?? 3000) * 1000 };
  return cachedToken.value;
}

async function google(url: string, init: RequestInit = {}): Promise<unknown> {
  const token = await accessToken();
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new GoogleError('Could not reach Google.');
  }
  if (res.status === 404) throw new GoogleError('Google could not find that spreadsheet or tab. Check SHEET_ID and SHEET_TAB.');
  if (res.status === 403) throw new GoogleError('Google refused access. Check the sheet is shared with your account and the scopes are granted.');
  if (!res.ok) throw new GoogleError(`Google returned HTTP ${res.status}.`);
  return res.json();
}

// ---- Sheets ----

export interface SheetRow {
  /** 1-based sheet row number. */
  row: number;
  values: Record<string, string>;
}

export interface SheetClient {
  readRows(): Promise<SheetRow[]>;
  /** Writes the given columns on one row, adding missing header columns first. */
  updateRow(row: number, values: Record<string, string>): Promise<void>;
}

/** 0 -> A, 25 -> Z, 26 -> AA */
export function columnLetter(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Turn the raw values grid (header row first) into keyed rows. */
export function rowsFromGrid(grid: string[][]): { headers: string[]; rows: SheetRow[] } {
  const headers = (grid[0] ?? []).map((h) => String(h ?? '').trim());
  const rows: SheetRow[] = [];
  grid.slice(1).forEach((cells, i) => {
    const values: Record<string, string> = {};
    headers.forEach((h, c) => {
      if (h) values[h] = String(cells[c] ?? '').trim();
    });
    if (Object.values(values).some(Boolean)) rows.push({ row: i + 2, values });
  });
  return { headers, rows };
}

/** Read a column case-insensitively ("first name" matches "First Name"). */
export function cell(values: Record<string, string>, name: string): string {
  const key = Object.keys(values).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? values[key] : '';
}

export function googleSheet(): SheetClient {
  const id = process.env.SHEET_ID;
  const tab = process.env.SHEET_TAB || 'Leads / Unprocessed';
  const base = () => {
    if (!id) throw new GoogleError('SHEET_ID is not set in .env.local.');
    return `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values`;
  };
  const quotedTab = `'${tab.replace(/'/g, "''")}'`;
  let headers: string[] = [];

  async function load() {
    const body = (await google(`${base()}/${encodeURIComponent(`${quotedTab}!A:Z`)}`)) as { values?: string[][] };
    const parsed = rowsFromGrid(body.values ?? []);
    headers = parsed.headers;
    return parsed.rows;
  }

  return {
    readRows: load,
    async updateRow(row, values) {
      if (!headers.length) await load();
      const data: { range: string; values: string[][] }[] = [];
      for (const [name, value] of Object.entries(values)) {
        let col = headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
        if (col === -1) {
          col = headers.length;
          headers.push(name);
          data.push({ range: `${quotedTab}!${columnLetter(col)}1`, values: [[name]] });
        }
        data.push({ range: `${quotedTab}!${columnLetter(col)}${row}`, values: [[value]] });
      }
      await google(`${base()}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({ valueInputOption: 'RAW', data }),
      });
    },
  };
}

// ---- Gmail ----

export async function gmailSend(input: MimeInput): Promise<string> {
  const raw = toBase64Url(buildMime(input));
  const body = (await google('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    body: JSON.stringify({ raw }),
  })) as { id?: string };
  return body.id ?? '';
}
