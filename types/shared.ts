// Shared types used by the API route and the dashboard.

export type PageType = 'people-search' | 'feed' | 'profile' | 'other';

export interface ConnectionSuggestion {
  name: string;
  title: string;
  reason: string;
}

export interface PostSuggestion {
  worthEngaging: boolean;
  reason: string;
  /** A draft comment for you to edit and post yourself. */
  commentDraft?: string;
}

export interface ProfileAnalysis {
  shouldConnect: boolean;
  reason: string;
  /** A draft connection note for you to edit and send yourself. */
  message?: string;
}

export type AnalysisResult =
  | { pageType: 'people-search'; suggestions: ConnectionSuggestion[] }
  | { pageType: 'feed'; post: PostSuggestion }
  | { pageType: 'profile'; profile: ProfileAnalysis };

export interface AnalyzeResponse {
  ok: true;
  url: string;
  capturedAt: string;
  result: AnalysisResult;
}

export interface AnalyzeError {
  ok: false;
  /** Machine-readable reason, so the UI can decide how to show it. */
  code: 'forbidden' | 'screenpipe-unreachable' | 'no-linkedin' | 'unsupported-page' | 'rate-limited' | 'ai-error' | 'bad-ai-output';
  message: string;
}

export interface Stats {
  analyses: number;
  connectionsSuggested: number;
  postsFlagged: number;
  lastActivity: string;
  lastRun: number;
}

export interface ErrorLog {
  timestamp: string;
  error: string;
}

export const STORAGE_KEY = 'linkedin-assistant';
/** Minimum gap between analyses, enforced by the server route. */
export const RATE_LIMIT_MS = 30_000;
/** How often Auto mode re-checks while the dashboard is open. */
export const AUTO_INTERVAL_MS = 60_000;
