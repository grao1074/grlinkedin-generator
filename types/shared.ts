// Shared types used across the application

export interface Stats {
  connectionsSuggested: number;
  postsLiked: number;
  messagesSent: number;
  lastActivity: string;
  lastRun: number;
}

export interface ConnectionSuggestion {
  name: string;
  title: string;
  reason: string;
}

export interface ProfileAnalysis {
  shouldConnect: boolean;
  reason: string;
  message?: string;
}

export interface ErrorLog {
  timestamp: string;
  error: string;
}

export interface AutomationSettings {
  enabled: boolean;
  rateLimitMs?: number;
  maxConnectionsPerDay?: number;
  maxLikesPerDay?: number;
}

export const SETTINGS_KEY = 'linkedin-automator';
export const RATE_LIMIT_MS = 30000; // 30 seconds between actions
