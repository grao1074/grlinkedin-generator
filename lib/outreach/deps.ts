import { chat, type ChatMessage } from '../ai';
import { fetchCompany, fetchProfile, searchCompanies, searchPeople } from './apify';
import { gmailSend, googleSheet, type SheetClient } from './google';
import type { SearchResult } from './match';
import type { MimeInput } from './mime';
import { mockDeps } from './mock';

/** Everything that talks to the outside world, swappable for tests and demo mode. */
export interface Deps {
  searchPeople(firstName: string, lastName: string, company: string): Promise<SearchResult[]>;
  searchCompanies(company: string): Promise<SearchResult[]>;
  fetchProfile(url: string): Promise<unknown | null>;
  fetchCompany(url: string): Promise<unknown | null>;
  chat(messages: ChatMessage[]): Promise<string>;
  sheet: SheetClient;
  sendMail(input: MimeInput): Promise<string>;
}

export function isMockMode(): boolean {
  return process.env.OUTREACH_MOCK === '1';
}

let real: Deps | null = null;

export function getDeps(): Deps {
  if (isMockMode()) return mockDeps();
  real ??= {
    searchPeople,
    searchCompanies,
    fetchProfile,
    fetchCompany,
    chat,
    sheet: googleSheet(),
    sendMail: gmailSend,
  };
  return real;
}
