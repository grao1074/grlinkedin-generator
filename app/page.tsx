'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AnalyzeError,
  AnalyzeResponse,
  ErrorLog,
  Stats,
} from '../types/shared';
import { AUTO_INTERVAL_MS, STORAGE_KEY } from '../types/shared';
import { CopyButton } from './components/CopyButton';

const EMPTY_STATS: Stats = {
  analyses: 0,
  connectionsSuggested: 0,
  postsFlagged: 0,
  lastActivity: 'No activity yet',
  lastRun: 0,
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(`${STORAGE_KEY}-${key}`, JSON.stringify(value));
  } catch {
    /* storage full or blocked: keep working without saving */
  }
}

export default function LinkedInAssistant() {
  const [autoMode, setAutoMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [latest, setLatest] = useState<AnalyzeResponse | null>(null);
  const [errorLog, setErrorLog] = useState<ErrorLog[]>([]);
  const busy = useRef(false);

  useEffect(() => {
    setStats(load('stats', EMPTY_STATS));
    setLatest(load<AnalyzeResponse | null>('latest', null));
    setErrorLog(load<ErrorLog[]>('errors', []));
    setAutoMode(load('auto', false));
  }, []);

  const logError = useCallback((error: string) => {
    setErrorLog((prev) => {
      const next = [...prev, { timestamp: new Date().toISOString(), error }].slice(-10);
      save('errors', next);
      return next;
    });
  }, []);

  const analyze = useCallback(
    async (silent = false) => {
      if (busy.current) return;
      busy.current = true;
      setIsLoading(true);
      if (!silent) setNotice(null);
      try {
        const res = await fetch('/api/analyze', { method: 'POST' });
        const body = (await res.json()) as AnalyzeResponse | AnalyzeError;

        if (!body.ok) {
          // Not seeing LinkedIn, or waiting on the rate limit, is normal in Auto mode.
          const routine = ['no-linkedin', 'unsupported-page', 'rate-limited'].includes(body.code);
          if (!silent || !routine) setNotice({ kind: routine ? 'info' : 'error', text: body.message });
          if (!routine) logError(body.message);
          return;
        }

        setLatest(body);
        save('latest', body);
        setNotice(null);
        setStats((prev) => {
          const r = body.result;
          const next: Stats = {
            analyses: prev.analyses + 1,
            connectionsSuggested:
              prev.connectionsSuggested +
              (r.pageType === 'people-search'
                ? r.suggestions.length
                : r.pageType === 'profile' && r.profile.shouldConnect
                  ? 1
                  : 0),
            postsFlagged:
              prev.postsFlagged + (r.pageType === 'feed' && r.post.worthEngaging ? 1 : 0),
            lastActivity: `Analysed a ${r.pageType.replace('-', ' ')} page`,
            lastRun: Date.now(),
          };
          save('stats', next);
          return next;
        });
      } catch {
        const text = 'Could not reach the local server. Is `bun dev` still running?';
        setNotice({ kind: 'error', text });
        logError(text);
      } finally {
        busy.current = false;
        setIsLoading(false);
      }
    },
    [logError]
  );

  // Auto mode: re-check on a timer, only while this tab is open and visible.
  useEffect(() => {
    if (!autoMode) return;
    const tick = () => {
      if (document.visibilityState === 'visible') analyze(true);
    };
    const id = setInterval(tick, AUTO_INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoMode, analyze]);

  const toggleAuto = () => {
    const next = !autoMode;
    setAutoMode(next);
    save('auto', next);
  };

  const resetAll = () => {
    setStats(EMPTY_STATS);
    setLatest(null);
    setErrorLog([]);
    setNotice(null);
    for (const k of ['stats', 'latest', 'errors']) {
      try {
        localStorage.removeItem(`${STORAGE_KEY}-${k}`);
      } catch {
        /* ignore */
      }
    }
  };

  const r = latest?.result;

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <section className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">GR LinkedIn Assistant</h1>
              <p className="text-gray-600 mt-2">
                Suggestions for the LinkedIn page you are viewing. You decide what to do.
              </p>
            </div>
            <div className="flex items-center gap-2" aria-live="polite">
              <span
                className={`w-3 h-3 rounded-full ${autoMode ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}
              />
              <span className="text-sm font-medium">{autoMode ? 'Auto on' : 'Auto off'}</span>
            </div>
          </div>

          {notice && (
            <div
              role="status"
              className={`mb-4 px-4 py-3 rounded-lg border text-sm ${
                notice.kind === 'error'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              {notice.text}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h2 className="font-semibold text-blue-900">Analyses</h2>
              <p className="text-3xl font-bold text-blue-600">{stats.analyses}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h2 className="font-semibold text-green-900">People suggested</h2>
              <p className="text-3xl font-bold text-green-600">{stats.connectionsSuggested}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h2 className="font-semibold text-purple-900">Posts worth a reply</h2>
              <p className="text-3xl font-bold text-purple-600">{stats.postsFlagged}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => analyze(false)}
              disabled={isLoading}
              className="flex-1 py-3 px-6 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Analysing…' : 'Analyse current page'}
            </button>
            <button
              type="button"
              onClick={toggleAuto}
              aria-pressed={autoMode}
              className={`flex-1 py-3 px-6 rounded-lg font-medium ${
                autoMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
              }`}
            >
              {autoMode ? 'Stop auto mode' : 'Start auto mode (every 60 s)'}
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="py-3 px-6 rounded-lg font-medium bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 text-sm"
            >
              Reset
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Last: {stats.lastActivity}
            {stats.lastRun ? ` at ${new Date(stats.lastRun).toLocaleString()}` : ''}
          </p>
        </section>

        {latest && r && (
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold text-gray-900">Latest suggestions</h2>
            <p className="text-xs text-gray-500 mb-4 break-all">{latest.url}</p>

            {r.pageType === 'people-search' &&
              (r.suggestions.length ? (
                <ul className="space-y-3">
                  {r.suggestions.map((s, i) => (
                    <li key={i} className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <p className="font-medium text-blue-900">{s.name}</p>
                      <p className="text-sm text-blue-700">{s.title}</p>
                      <p className="text-xs text-blue-600 mt-2">{s.reason}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-600">No one on this page looked like a strong fit.</p>
              ))}

            {r.pageType === 'feed' && (
              <div className="bg-green-50 p-4 rounded-lg border border-green-100 space-y-2">
                <p className="font-medium text-green-900">
                  {r.post.worthEngaging ? 'Worth engaging with' : 'Probably skip this one'}
                </p>
                <p className="text-sm text-green-800">{r.post.reason}</p>
                {r.post.commentDraft && (
                  <div className="bg-white p-3 rounded border border-green-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-gray-500">Draft comment (edit before posting)</span>
                      <CopyButton text={r.post.commentDraft} />
                    </div>
                    <p className="text-sm text-gray-800">{r.post.commentDraft}</p>
                  </div>
                )}
              </div>
            )}

            {r.pageType === 'profile' && (
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 space-y-2">
                <p className="font-medium text-yellow-900">
                  {r.profile.shouldConnect ? 'Good connection' : 'Not an obvious fit'}
                </p>
                <p className="text-sm text-yellow-800">{r.profile.reason}</p>
                {r.profile.message && (
                  <div className="bg-white p-3 rounded border border-yellow-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-gray-500">Draft note (edit before sending)</span>
                      <CopyButton text={r.profile.message} />
                    </div>
                    <p className="text-sm text-gray-800">{r.profile.message}</p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {errorLog.length > 0 && (
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Error log</h2>
            <ul className="space-y-2">
              {errorLog
                .slice(-5)
                .reverse()
                .map((log, i) => (
                  <li key={i} className="bg-red-50 p-3 rounded-lg border border-red-100">
                    <p className="text-xs text-red-700 font-mono">{log.error}</p>
                    <p className="text-xs text-red-500 mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                  </li>
                ))}
            </ul>
          </section>
        )}

        <section className="bg-gray-100 border border-gray-300 rounded-lg p-6">
          <h2 className="font-medium text-gray-900 mb-3">How it works and what it will not do</h2>
          <ul className="space-y-2 text-sm text-gray-700 list-disc pl-5">
            <li>Screenpipe records your screen locally. This app reads the latest LinkedIn page from it.</li>
            <li>Works on people search results, your feed, and profile pages.</li>
            <li>
              Page text goes to the AI service set in <code>.env.local</code> (a local Ollama model by default).
            </li>
            <li>
              It never clicks, likes, comments, connects or sends messages. Draft text is for you to edit and
              post yourself. Automating those actions is against LinkedIn&apos;s User Agreement and can get an
              account restricted.
            </li>
            <li>At most one analysis every 30 seconds.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
