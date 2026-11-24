import type { SearchResult } from './match';

/**
 * Calls the same three Apify actors the original n8n workflow used, through
 * the synchronous run-and-return-items endpoint. Each call is one billed
 * actor run, so callers cache results.
 */

const APIFY_BASE = 'https://api.apify.com/v2/acts';
const ACTORS = {
  search: 'apify~rag-web-browser',
  profile: 'apimaestro~linkedin-profile-detail',
  company: 'apimaestro~linkedin-company-detail',
};
const PERSON_RESULTS = 10;
const COMPANY_RESULTS = 5;

export class ApifyError extends Error {}

async function runActor(actor: string, input: Record<string, unknown>): Promise<unknown[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new ApifyError('APIFY_TOKEN is not set in .env.local.');

  let res: Response;
  try {
    res = await fetch(`${APIFY_BASE}/${actor}/run-sync-get-dataset-items?memory=4096&timeout=180`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(200_000),
    });
  } catch {
    throw new ApifyError(`Could not reach Apify (${actor}). Check your internet connection.`);
  }
  if (res.status === 401 || res.status === 403) throw new ApifyError('Apify rejected the token. Check APIFY_TOKEN.');
  if (res.status === 402) throw new ApifyError('Apify says your account is out of credit.');
  if (!res.ok) throw new ApifyError(`Apify ${actor} returned HTTP ${res.status}.`);

  const body: unknown = await res.json().catch(() => null);
  if (!Array.isArray(body)) throw new ApifyError(`Apify ${actor} returned an unexpected reply.`);
  return body;
}

function toSearchResults(items: unknown[]): SearchResult[] {
  return items
    .map((i) => (i && typeof i === 'object' ? (i as { searchResult?: Record<string, unknown> }).searchResult : undefined))
    .filter((s): s is Record<string, unknown> => !!s && typeof s.url === 'string')
    .map((s) => ({
      url: String(s.url),
      title: typeof s.title === 'string' ? s.title : '',
      description: typeof s.description === 'string' ? s.description : '',
    }));
}

/** Strip quotes so a lead's name cannot break the search query. */
const q = (s: string) => s.replace(/["']/g, '').trim();

export async function searchPeople(firstName: string, lastName: string, company: string): Promise<SearchResult[]> {
  const query = `"${q(firstName)} ${q(lastName)}" ${q(company)} site:linkedin.com/in`;
  return toSearchResults(await runActor(ACTORS.search, { query, maxResults: PERSON_RESULTS }));
}

export async function searchCompanies(company: string): Promise<SearchResult[]> {
  const query = `"${q(company)}" site:linkedin.com/company`;
  return toSearchResults(await runActor(ACTORS.search, { query, maxResults: COMPANY_RESULTS }));
}

export async function fetchProfile(url: string): Promise<unknown | null> {
  const items = await runActor(ACTORS.profile, { username: url });
  return items[0] ?? null;
}

export async function fetchCompany(url: string): Promise<unknown | null> {
  const items = await runActor(ACTORS.company, { identifier: [url] });
  return items[0] ?? null;
}
