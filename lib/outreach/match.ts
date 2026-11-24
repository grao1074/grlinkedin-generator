import type { Candidate, CompanySummary, Experience, ProfileSummary } from '../../types/outreach';

/**
 * Pure helpers for finding the right LinkedIn person and company.
 * No network calls here, so everything is unit-tested.
 */

const PERSON_PATH = /^\/in\/([A-Za-z0-9\-_%]+)\/?$/;
const COMPANY_PATH = /^\/company\/([A-Za-z0-9\-_%]+)\/?$/;

function linkedInPath(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const host = u.hostname.toLowerCase();
    // www.linkedin.com, linkedin.com and regional hosts such as uk.linkedin.com
    if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return null;
    return u.pathname;
  } catch {
    return null;
  }
}

/** Canonical https://www.linkedin.com/in/<slug> URL, or null if it is not a profile page. */
export function normalizePersonUrl(url: string): string | null {
  const path = linkedInPath(url);
  const m = path?.match(PERSON_PATH);
  return m ? `https://www.linkedin.com/in/${m[1]}` : null;
}

/** Canonical https://www.linkedin.com/company/<slug> URL, or null if it is not a company page. */
export function normalizeCompanyUrl(url: string): string | null {
  const path = linkedInPath(url);
  const m = path?.match(COMPANY_PATH);
  return m ? `https://www.linkedin.com/company/${m[1]}` : null;
}

/** Lowercase, strip accents and punctuation, split into words. */
export function tokens(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

// Words that say nothing about which company it is.
const COMPANY_NOISE = new Set([
  'the', 'and', 'of', 'inc', 'ltd', 'llc', 'limited', 'plc', 'co', 'corp', 'corporation', 'company',
  'group', 'gmbh', 'nhs', 'trust', 'foundation', 'uk', 'us',
]);

export function companyTokens(company: string): string[] {
  const all = tokens(company);
  const useful = all.filter((t) => !COMPANY_NOISE.has(t));
  return useful.length ? useful : all;
}

/** Share of the company's useful words that appear in the text (0 to 1). */
export function companyMatch(company: string, text: string): number {
  const want = companyTokens(company);
  if (!want.length) return 0;
  const have = new Set(tokens(text));
  return want.filter((t) => have.has(t)).length / want.length;
}

/** 1 when first and last name both appear in the candidate name, 0.5 for one, else 0. */
export function nameMatch(firstName: string, lastName: string, candidateName: string): number {
  const have = new Set(tokens(candidateName));
  const first = tokens(firstName);
  const last = tokens(lastName);
  const hit = (parts: string[]) => parts.length > 0 && parts.every((p) => have.has(p));
  return (hit(first) ? 0.5 : 0) + (hit(last) ? 0.5 : 0);
}

/**
 * Overall match score. Name counts for 60%, company for 40%, so the right
 * name at the wrong company (the "John Smith at Walmart" problem) never
 * reaches the default 0.8 threshold on its own.
 */
export function scoreCandidate(
  lead: { firstName: string; lastName: string; company: string },
  candidate: { name: string; headline: string; snippet: string }
): number {
  const name = nameMatch(lead.firstName, lead.lastName, candidate.name);
  const company = companyMatch(lead.company, `${candidate.headline} ${candidate.snippet}`);
  return Math.round((0.6 * name + 0.4 * company) * 100) / 100;
}

/** Split a search-result title like "Jane Doe - Consultant - Acme | LinkedIn". */
export function parseResultTitle(title: string): { name: string; headline: string } {
  const cleaned = title.replace(/\s*[|·]\s*LinkedIn.*$/i, '').trim();
  const parts = cleaned.split(/\s+[-–—]\s+/);
  return { name: (parts[0] || '').trim(), headline: parts.slice(1).join(' - ').trim() };
}

export interface SearchResult {
  url: string;
  title: string;
  description: string;
}

/** Profile candidates from web search results, best first, de-duplicated, max 3. */
export function buildCandidates(
  lead: { firstName: string; lastName: string; company: string },
  results: SearchResult[]
): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const r of results) {
    const url = normalizePersonUrl(r.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const { name, headline } = parseResultTitle(r.title || '');
    const snippet = (r.description || '').slice(0, 300);
    out.push({ url, name: name || url, headline, snippet, score: scoreCandidate(lead, { name, headline, snippet }) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}

/** The best candidate if it clears the threshold and is clearly ahead of the runner-up. */
export function pickConfident(candidates: Candidate[], threshold: number): Candidate | null {
  const [best, second] = candidates;
  if (!best || best.score < threshold) return null;
  // Two people who both match well: let a human decide.
  if (second && second.score >= threshold) return null;
  return best;
}

/** First company page among search results whose name matches the lead's company. */
export function pickCompanyResult(company: string, results: SearchResult[]): string | null {
  for (const r of results) {
    const url = normalizeCompanyUrl(r.url);
    if (url && companyMatch(company, `${r.title} ${r.description} ${url.replace(/-/g, ' ')}`) >= 0.5) return url;
  }
  return null;
}

/**
 * The company page for this person: the profile's current company if it
 * matches the lead's company, else a current role that matches, else null
 * (the caller then searches the web).
 */
export function companyUrlFromProfile(profile: ProfileSummary, leadCompany: string): string | null {
  const current = normalizeCompanyUrl(profile.currentCompanyUrl);
  if (current && (!leadCompany || companyMatch(leadCompany, profile.currentCompany) >= 0.5)) return current;
  const role = profile.experience.find(
    (e: Experience) => e.isCurrent && companyMatch(leadCompany, e.company) >= 0.5 && normalizeCompanyUrl(e.companyUrl)
  );
  if (role) return normalizeCompanyUrl(role.companyUrl);
  return current && !leadCompany ? current : null;
}

// ---- Turning raw Apify output into small, safe summaries ----

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown, max = 500): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function summarizeProfile(raw: unknown, url: string): ProfileSummary {
  const r = obj(raw);
  const b = obj(r.basic_info);
  const loc = obj(b.location);
  return {
    url,
    fullName: str(b.fullname, 120) || [str(b.first_name, 60), str(b.last_name, 60)].filter(Boolean).join(' '),
    headline: str(b.headline, 300),
    about: str(b.about, 1500),
    location: str(loc.full, 120),
    currentCompany: str(b.current_company, 120),
    currentCompanyUrl: str(b.current_company_url, 300),
    experience: arr(r.experience)
      .slice(0, 6)
      .map((e) => {
        const x = obj(e);
        return {
          title: str(x.title, 150),
          company: str(x.company, 150),
          description: str(x.description, 600),
          duration: str(x.duration, 80),
          isCurrent: x.is_current === true,
          companyUrl: str(x.company_linkedin_url, 300),
        };
      }),
    education: arr(r.education)
      .slice(0, 4)
      .map((e) => ({ school: str(obj(e).school, 150), degree: str(obj(e).degree, 200) })),
    certifications: arr(r.certifications)
      .slice(0, 6)
      .map((c) => str(obj(c).name, 150))
      .filter(Boolean),
  };
}

export function summarizeCompany(raw: unknown, url: string): CompanySummary {
  const r = obj(raw);
  const b = obj(r.basic_info);
  const stats = obj(r.stats);
  const hq = obj(obj(r.locations).headquarters);
  const count = stats.employee_count;
  return {
    url,
    name: str(b.name, 150),
    description: str(b.description, 1500),
    // Scraped text ends up in a link, so only allow plain web addresses.
    website: /^https?:\/\/[^\s"'<>]+$/i.test(str(b.website, 200)) ? str(b.website, 200) : '',
    industries: arr(b.industries).map((i) => str(i, 80)).filter(Boolean).slice(0, 5),
    specialties: arr(b.specialties).map((s) => str(s, 80)).filter(Boolean).slice(0, 10),
    employeeCount: typeof count === 'number' ? count : null,
    headquarters: [str(hq.city, 80), str(hq.country, 40)].filter(Boolean).join(', '),
  };
}

/** True when a profile summary has enough in it to write a personal email. */
export function hasUsefulProfile(p: ProfileSummary | undefined): boolean {
  return !!p && !!(p.fullName && (p.headline || p.about || p.experience.length));
}
