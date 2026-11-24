// Types shared by the outreach API routes and the /outreach dashboard.

export type LeadStatus =
  | 'new' // imported, not processed yet
  | 'searching' // looking for the LinkedIn profile
  | 'needs-match' // no confident match: you pick the right person
  | 'enriching' // fetching profile and company details
  | 'enriched' // details found; draft not written yet (e.g. Settings incomplete)
  | 'drafting' // AI is writing the email
  | 'drafted' // waiting for your review
  | 'approved' // you approved it; ready to send
  | 'sending'
  | 'sent'
  | 'skipped'
  | 'failed';

/** Statuses where background work is running, so the UI keeps polling. */
export const ACTIVE_STATUSES: LeadStatus[] = ['searching', 'enriching', 'drafting', 'sending'];

export interface Candidate {
  url: string;
  name: string;
  headline: string;
  snippet: string;
  /** 0 to 1. How well the name and company match the lead. */
  score: number;
}

export interface Experience {
  title: string;
  company: string;
  description: string;
  duration: string;
  isCurrent: boolean;
  companyUrl: string;
}

export interface ProfileSummary {
  url: string;
  fullName: string;
  headline: string;
  about: string;
  location: string;
  currentCompany: string;
  currentCompanyUrl: string;
  experience: Experience[];
  education: { school: string; degree: string }[];
  certifications: string[];
}

export interface CompanySummary {
  url: string;
  name: string;
  description: string;
  website: string;
  industries: string[];
  specialties: string[];
  employeeCount: number | null;
  headquarters: string;
}

export interface Fact {
  /** The claim the email relies on. */
  fact: string;
  /** Where it came from, e.g. "profile.experience[0]" or "company.description". */
  source: string;
}

export interface Draft {
  subject: string;
  body: string;
  factsUsed: Fact[];
  generatedAt: string;
  /** True once you have edited the AI text. */
  edited: boolean;
}

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  /** 1-based row number in the Google Sheet, when imported from it. */
  sheetRow?: number;
  status: LeadStatus;
  error?: string;
  candidates: Candidate[];
  profileUrl?: string;
  companyUrl?: string;
  profile?: ProfileSummary;
  companyInfo?: CompanySummary;
  draft?: Draft;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  senderName: string;
  /** Your Gmail address. Used for the From header display name. */
  senderEmail: string;
  replyTo: string;
  /** Who you are and what you do, in your own words. */
  about: string;
  /** What you are asking for or offering. */
  offer: string;
  /** The one action you want the reader to take. */
  callToAction: string;
  tone: string;
  signature: string;
  optOutText: string;
  postalAddress: string;
  dailySendCap: number;
  /** Seconds to wait between sends. */
  sendDelaySeconds: number;
  /** Candidates scoring at or above this are picked without asking. */
  matchThreshold: number;
}

export const DEFAULT_SETTINGS: Settings = {
  senderName: '',
  senderEmail: '',
  replyTo: '',
  about: '',
  offer: '',
  callToAction: '',
  tone: 'Warm, plain and professional. Short sentences. No jokes, no hype, no buzzwords, no em dashes.',
  signature: '',
  optOutText: "If you'd rather not hear from me again, just reply \"no thanks\" and I won't email you again.",
  postalAddress: '',
  dailySendCap: 20,
  sendDelaySeconds: 30,
  matchThreshold: 0.8,
};

/** Settings fields that must be filled in before drafting. */
export const REQUIRED_SETTINGS: (keyof Settings)[] = ['senderName', 'about', 'offer', 'callToAction'];

export interface LeadsResponse {
  ok: true;
  leads: Lead[];
  sentToday: number;
  dailySendCap: number;
  suppressedCount: number;
  mock: boolean;
}

export interface OutreachError {
  ok: false;
  message: string;
}
